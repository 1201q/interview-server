import { Processor, WorkerHost } from "@nestjs/bullmq";
import { DelayedError } from "bullmq";
import type { Job } from "bullmq";

import { DataSource, Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { Injectable, Logger } from "@nestjs/common";
import {
  Answer,
  AnswerAnalysis,
  InterviewSession,
} from "@/common/entities/entities";

import { OciDBService } from "@/external-server/oci-db.service";
import axios from "axios";
import { FlaskServerService } from "@/external-server/flask-server.service";
import { FeedbackDto } from "./analysis.dto";
import { AnalysisEventsService } from "./analysis.events.service";
import { AnalysisAiService } from "./analysis-ai.service";
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
@Processor("analysis", { concurrency: 4 })
export class AnalysisWorker extends WorkerHost {
  private readonly logger = new Logger(AnalysisWorker.name);

  constructor(
    private readonly ds: DataSource,

    @InjectRepository(AnswerAnalysis)
    private readonly repo: Repository<AnswerAnalysis>,

    @InjectRepository(InterviewSession)
    private readonly sessionRepo: Repository<InterviewSession>,

    private readonly ai: AnalysisAiService,
    private readonly ociService: OciDBService,
    private readonly flaskService: FlaskServerService,
    private readonly events: AnalysisEventsService,
  ) {
    super();
  }

  private async computeAndUpdateProgress(answerId: string) {
    const weights = { stt: 25, refine: 25, audio: 25, feedback: 25 } as const;

    const row = await this.repo.findOne({
      where: { answer: { id: answerId } },
      relations: ["answer"],
    });

    if (!row) return;

    const flags = {
      stt: !!row.stt_json,
      refine: !!row.refined_json,
      audio: !!row.voice_json,
      feedback: !!row.feedback_json,
    };

    const progress =
      (flags.stt ? weights.stt : 0) +
      (flags.refine ? weights.refine : 0) +
      (flags.audio ? weights.audio : 0) +
      (flags.feedback ? weights.feedback : 0);

    await this.repo
      .createQueryBuilder()
      .update(AnswerAnalysis)
      .set({
        progress,
        status: progress === 100 ? "completed" : "processing",
      })
      .where("answer_id = :answerId", { answerId })
      .execute();
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

  private async getFeedbackDto(
    sessionId: string,
    answerId: string,
  ): Promise<FeedbackDto | null> {
    const dto = new FeedbackDto();

    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ["request"],
    });

    const analysis = await this.getAnalysis(answerId);

    if (!session?.request || !session.request.vector_id || !analysis)
      return null;

    dto.vectorId = session.request.vector_id;
    dto.questionText = analysis.answer.session_question.question.text;
    dto.rubric = analysis.answer.session_question.rubric_json;
    dto.segments = (analysis.refined_json as any[]) || [];

    return dto;
  }

  private async isSessionReady(sessionId: string) {
    const row = await this.ds.getRepository(InterviewSession).findOne({
      where: { id: sessionId },
      select: ["rubric_gen_status", "role_guess"],
    });

    return (
      row?.rubric_gen_status === "completed" &&
      !!row?.role_guess &&
      row.role_guess.trim().length > 0
    );
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

  private emitProgress(
    sessionId: string,
    answerId: string,
    stage: "stt" | "refine" | "audio" | "feedback" | "overall",
    value: number,
  ) {
    this.events.emit(sessionId, {
      type: "progress",
      session_id: sessionId,
      answer_id: answerId,
      stage,
      value,
    });
  }

  // 1. STT
  private async handleStt(
    job: Job<{ answerId: string; sessionId: string }>,
    token?: string,
  ) {
    const { answerId, sessionId } = job.data;

    try {
      await this.markStageStart(job, sessionId, answerId, "stt");

      const answer = await this.ds.getRepository(Answer).findOne({
        where: { id: answerId },
        relations: ["session_question"],
      });

      if (!answer || !answer.audio_path) {
        this.logger.error(
          `Answer not found or missing audio_path for ID: ${answerId}`,
        );
        throw new Error("Answer not found");
      }

      // 1. url 발급
      const url = await this.ociService.generatePresignedUrl(answer.audio_path);

      // 2. 스트림 다운로드
      const stream = await this.downloadStream(url, answer.audio_path);

      // 3. STT API 호출
      const result = await this.ai.transcript(stream as any);

      await this.repo
        .createQueryBuilder()
        .update(AnswerAnalysis)
        .set({ stt_json: result })
        .where("answer_id = :answerId", { answerId })
        .execute();

      await this.markStageComplete(job, sessionId, answerId, "stt");
      return { ok: true, sessionId, answerId };
    } catch (error) {
      this.emitFailed(sessionId, answerId, error);
      throw error;
    }
  }

  // 2. refine
  private async handleRefine(
    job: Job<{ answerId: string; sessionId: string }>,
    token?: string,
  ) {
    const { answerId, sessionId } = job.data;

    try {
      await this.markStageStart(job, sessionId, answerId, "refine");

      const analysis = await this.getAnalysis(answerId);
      const sttJson = analysis?.stt_json as { segments?: any[] } | undefined;

      if (
        !sttJson ||
        !Array.isArray(sttJson.segments) ||
        sttJson.segments.length === 0
      ) {
        this.logger.debug(
          `Refine : STT 결과가 없거나 segments가 없습니다. answerId: ${answerId}`,
        );
        return this.delayAndExit(job, 5_000, token);
      }

      const questionText = analysis.answer.session_question.question.text;

      const refined = await this.ai.refineSttSegments({
        questionText: questionText,
        segments: sttJson.segments,
      });

      await this.repo
        .createQueryBuilder()
        .update(AnswerAnalysis)
        .set({ refined_json: refined })
        .where("answer_id = :answerId", { answerId })
        .execute();

      await this.markStageComplete(job, sessionId, answerId, "refine");
      return { ok: true, sessionId, answerId };
    } catch (error) {
      this.emitFailed(sessionId, answerId, error);
      throw error;
    }
  }

  // 3. Audio-Wait
  private async handleAudioWait(
    job: Job<{ answerId: string; triggered?: boolean; sessionId: string }>,
    token?: string,
  ) {
    const { sessionId, answerId } = job.data;

    try {
      await this.markStageStart(job, sessionId, answerId, "audio");

      const analysis = await this.getAnalysis(answerId);

      if (analysis?.voice_json) {
        // 이미 처리된 경우
        await this.markStageComplete(job, sessionId, answerId, "audio");
        return { ok: true, sessionId, answerId };
      }

      const res = await this.triggerAudioAnalyze(answerId);

      if (res.ok && res.data) {
        await this.repo
          .createQueryBuilder()
          .update(AnswerAnalysis)
          .set({ voice_json: res.data })
          .where("answer_id = :answerId", { answerId })
          .execute();

        await this.markStageComplete(job, sessionId, answerId, "audio");
        return { ok: true, sessionId, answerId };
      }

      return this.delayAndExit(job, 30_000, token);
    } catch (error) {
      this.emitFailed(sessionId, answerId, error);
      throw error;
    }
  }

  private async triggerAudioAnalyze(
    answerId: string,
  ): Promise<{ ok: boolean; data?: any }> {
    const analysis = await this.getAnalysis(answerId);

    if (!analysis?.answer.audio_path) {
      this.logger.warn(`audio_path not found for answerId=${answerId}`);

      return { ok: false };
    }

    const audioPath = analysis.answer.audio_path;

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

    try {
      // refine 준비 여부
      const analysis = await this.getAnalysis(answerId);
      const refineReady = !!analysis?.refined_json;

      // rubric 준비 여부
      const rubricReady = await this.isSessionReady(sessionId);

      // check
      if (!refineReady || !rubricReady) {
        return this.delayAndExit(job, 15_000, token);
      }

      await this.markStageStart(job, sessionId, answerId, "feedback");

      // 실제 feedback 처리
      const dto = await this.getFeedbackDto(sessionId, answerId);
      if (!dto) {
        this.logger.error(`FeedbackDto 생성 실패: ${sessionId}, ${answerId}`);
        throw new Error("FeedbackDto creation failed");
      }

      const feedback = await this.ai.feedback(dto);
      await this.repo
        .createQueryBuilder()
        .update(AnswerAnalysis)
        .set({ feedback_json: feedback })
        .where("answer_id = :answerId", { answerId })
        .execute();

      await this.markStageComplete(job, sessionId, answerId, "feedback");
      return { ok: true, sessionId, answerId };
    } catch (error) {
      this.emitFailed(sessionId, answerId, error);
      throw error;
    }
  }

  // 5. parent job - 진행률 집계
  private async handleParent(
    job: Job<{ sessionId: string; answerId: string; progress: Progress }>,
  ) {
    const { answerId, sessionId } = job.data;

    await job.updateProgress(100);

    await this.repo
      .createQueryBuilder()
      .update(AnswerAnalysis)
      .set({ status: "completed", progress: 100 })
      .where("answer_id = :answerId", { answerId })
      .execute();

    this.events.emit(sessionId, {
      type: "completed",
      session_id: sessionId,
      answer_id: answerId,
    });

    return { ok: true, sessionId, answerId };
  }

  private async delayAndExit(job: Job, delayMs: number, token?: string) {
    await job.moveToDelayed(Date.now() + delayMs, token);
    throw new DelayedError();
  }

  private async downloadStream(url: string, filename: string) {
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      timeout: 10_000,
      maxContentLength: 50 * 1024 * 1024,
    });

    const file: MulterLike = {
      buffer: Buffer.from(res.data),
      originalname: filename,
      mimetype: res.headers["content-type"] || "audio/webm",
    };

    return file;
  }

  private emitFailed(sessionId: string, answerId: string, error: unknown) {
    this.events.emit(sessionId, {
      type: "failed",
      session_id: sessionId,
      answer_id: answerId,
      reason: (error as Error)?.message ?? "unknown error",
    });
  }

  private async markStageStart(
    job: Job,
    sessionId: string,
    answerId: string,
    stage: "stt" | "refine" | "audio" | "feedback",
  ) {
    this.emitProgress(sessionId, answerId, stage, 40);
    await job.updateProgress(40);
  }

  private async markStageComplete(
    job: Job,
    sessionId: string,
    answerId: string,
    stage: "stt" | "refine" | "audio" | "feedback",
  ) {
    this.emitProgress(sessionId, answerId, stage, 100);
    await job.updateProgress(100);
    await this.computeAndUpdateProgress(answerId);
  }
}
