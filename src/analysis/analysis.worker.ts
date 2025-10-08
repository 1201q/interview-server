import { Processor, WorkerHost } from "@nestjs/bullmq";
import { DelayedError } from "bullmq";
import type { Job } from "bullmq";

import { DataSource, Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { Injectable, Logger } from "@nestjs/common";
import { Answer, AnswerAnalysis } from "@/common/entities/entities";
import { AnalysisService } from "./analysis.service";
import { OciDBService } from "@/external-server/oci-db.service";
import axios from "axios";
import { FlaskServerService } from "@/external-server/flask-server.service";
type Progress = {
  stt: number;
  refine: number;
  audio: number;
  feedback: number;
};

type MulterLike = Pick<
  Express.Multer.File,
  "buffer" | "originalname" | "mimetype"
>;

@Injectable()
@Processor("analysis")
export class AnalysisWorker extends WorkerHost {
  private readonly logger = new Logger(AnalysisWorker.name);

  constructor(
    private readonly ds: DataSource,

    @InjectRepository(AnswerAnalysis)
    private readonly repo: Repository<AnswerAnalysis>,

    private readonly analysisService: AnalysisService,
    private readonly ociService: OciDBService,
    private readonly flaskService: FlaskServerService,
  ) {
    super();
  }

  // == db 조회 ==
  private async getAnalysis(answerId: string) {
    return this.repo.findOne({
      where: { answer: { id: answerId } },
      relations: [
        "answer",
        "answer.session_question",
        "answer.session_question.question",
      ],
    });
  }

  private async isRubricReady(sessionId: string) {
    return false;
  }

  // == 유틸 진행률 저장 ==
  private async setDbProgress(parentJobId: string, p: number) {
    await this.repo
      .createQueryBuilder()
      .update(AnswerAnalysis)
      .set({ progress: p })
      .where("bull_job_id = :parentJobId", { parentJobId })
      .execute();
  }

  async process(job: Job<any>, token?: string): Promise<any> {
    switch (job.name) {
      case "stt":
        return this.handleStt(job);
      case "refine":
        return this.handleRefine(job);
      case "audio-wait":
        return this.handleAudioWait(job, token);
      case "feedback-gate":
        return this.handleFeedbackGate(job, token);
      case "full-root":
        return this.handleParent(job);
      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  }

  // 1. STT
  private async handleStt(job: Job<{ answerId: string }>) {
    const { answerId } = job.data;
    await job.updateProgress(10);

    const answer = await this.ds.getRepository(Answer).findOne({
      where: { id: answerId },
      relations: ["session_question"],
    });

    if (!answer || !answer.audio_path) {
      this.logger.error(
        `Answer not found or missing audio_path for ID: ${answerId}`,
      );
      return;
    }

    // 1. url 발급
    const url = await this.ociService.generatePresignedUrl(answer.audio_path);
    this.logger.debug(`audio url: ${url}`);

    // 2. 스트림 다운로드
    const stream = await this.downloadStream(url, answer.audio_path);

    // 3. STT API 호출
    const result = await this.analysisService.transcript(stream as any);
    this.logger.debug(`STT result: ${result.text}`);
    this.logger.debug(`STT result: 완료`);

    await this.repo
      .createQueryBuilder()
      .update(AnswerAnalysis)
      .set({ stt_json: result })
      .where("answer_id = :answerId", { answerId })
      .execute();

    await job.updateProgress(100);
    return { ok: true };
  }

  // 2. refine
  private async handleRefine(job: Job<{ answerId: string }>) {
    const { answerId } = job.data;
    await job.updateProgress(10);

    const analysis = await this.getAnalysis(answerId);

    const sttJson = analysis?.stt_json as { segments?: any[] } | undefined;
    if (!sttJson || !Array.isArray(sttJson.segments)) {
      this.logger.error(
        `STT 결과가 없거나 segments가 없습니다. answerId: ${answerId}`,
      );
      return;
    }

    const questionText = analysis.answer.session_question.question.text;
    this.logger.debug(`질문: ${questionText}`);

    const refined = await this.analysisService.refineSttSegments({
      questionText: questionText,
      segments: sttJson.segments,
    });

    await this.repo
      .createQueryBuilder()
      .update(AnswerAnalysis)
      .set({ refined_json: refined })
      .where("answer_id = :answerId", { answerId })
      .execute();

    await job.updateProgress(100);
    return { ok: true };
  }

  // 3. Audio-Wait
  private async handleAudioWait(
    job: Job<{ answerId: string; triggered?: boolean }>,
    token?: string,
  ) {
    const { answerId } = job.data;
    const analysis = await this.getAnalysis(answerId);

    if (analysis?.voice_json) {
      // 이미 처리된 경우
      await job.updateProgress(100);
      return { ok: true };
    }

    const res = await this.triggerAudioAnalyze(answerId);

    if (res.ok && res.data) {
      await this.repo
        .createQueryBuilder()
        .update(AnswerAnalysis)
        .set({ voice_json: res.data })
        .where("answer_id = :answerId", { answerId })
        .execute();

      await job.updateProgress(100);
      this.logger.debug(`flask 분석 완료`);
      return { ok: true };
    }

    return this.delayAndExit(job, 30_000, token);
  }

  private async triggerAudioAnalyze(
    answerId: string,
  ): Promise<{ ok: boolean; data?: any }> {
    const analysis = await this.getAnalysis(answerId);
    const audioPath = analysis.answer.audio_path;

    this.logger.debug(`flask 분석 시작`);
    const result = await this.flaskService.getAnalysisFromObjectName(audioPath);

    if (result) {
      return { ok: true, data: result };
    }

    return { ok: false };
  }

  // 4. feedback-gate
  // refine, rubric 둘 다 준비되어야 실행
  private async handleFeedbackGate(
    job: Job<{ sessionId: string; answerId: string }>,
    token?: string,
  ) {
    const { sessionId, answerId } = job.data;

    // refine 준비 여부
    const analysis = await this.getAnalysis(answerId);
    const refineReady = !!analysis?.refined_json;

    // rubric 준비 여부
    const rubricReady = await this.isRubricReady(sessionId);

    // check
    if (!refineReady || !rubricReady) {
      return this.delayAndExit(job, 30_000, token);
    }

    // 실제 feedback 처리
    const feedback = { feedback: [] };

    await this.repo
      .createQueryBuilder()
      .update(AnswerAnalysis)
      .set({ feedback_json: feedback })
      .where("answer_id = :answerId", { answerId })
      .execute();

    await job.updateProgress(100);

    return { ok: true };
  }

  // 5. parent job - 진행률 집계
  private async handleParent(
    job: Job<{ sessionId: string; answerId: string; progress: Progress }>,
  ) {
    const { answerId } = job.data;
    await job.updateProgress(100);

    await this.repo
      .createQueryBuilder()
      .update(AnswerAnalysis)
      .set({ status: "completed", progress: 100 })
      .where("answer_id = :answerId", { answerId })
      .execute();

    return { ok: true };
  }

  private async delayAndExit(job: Job, delayMs: number, token?: string) {
    await job.moveToDelayed(Date.now() + delayMs, token);
    throw new DelayedError();
  }

  private async downloadStream(url: string, filename: string) {
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
    });

    const file: MulterLike = {
      buffer: Buffer.from(res.data),
      originalname: filename,
      mimetype: res.headers["content-type"] || "audio/webm",
    };

    return file;
  }
}
