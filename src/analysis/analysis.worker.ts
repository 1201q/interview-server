import { Processor, WorkerHost } from "@nestjs/bullmq";

import type { Job } from "bullmq";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { Injectable, Logger } from "@nestjs/common";
import { AnswerAnalysis } from "@/common/entities/entities";

type Progress = {
  stt: number;
  refine: number;
  audio: number;
  feedback: number;
};

@Injectable()
@Processor("analysis")
export class AnalysisWorker extends WorkerHost {
  private readonly logger = new Logger(AnalysisWorker.name);

  constructor(
    @InjectRepository(AnswerAnalysis)
    private readonly repo: Repository<AnswerAnalysis>,
  ) {
    super();
  }

  // == db 조회 ==
  private async getAnalysis(answerId: string) {
    return this.repo.findOne({ where: { answer: { id: answerId } } });
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

  async process(job: Job<any>): Promise<any> {
    switch (job.name) {
      case "stt":
        return this.handleStt(job);
      case "refine":
        return this.handleRefine(job);
      case "audio-wait":
        return this.handleAudioWait(job);
      case "feedback-gate":
        return this.handleFeedbackGate(job);
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

    // 실구현
    const stt = { segments: [], words: [] };

    await this.repo
      .createQueryBuilder()
      .update(AnswerAnalysis)
      .set({ stt_json: stt })
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

    // 실구현
    const refined = { refined: [] };

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
  ) {
    const { answerId } = job.data;
    const analysis = await this.getAnalysis(answerId);

    if (analysis?.voice_json) {
      // 이미 처리된 경우
      await job.updateProgress(100);
      return { ok: true };
    }

    if (!job.data.triggered) {
      // false인 경우 트리거
      await this.triggerAudioAnalyze(answerId, job.id as string);
      await job.updateData({ answerId, triggered: true });
    }

    const delayMs = 30 * 1000; // 30초
    await job.moveToDelayed(Date.now() + delayMs);

    return { waiting: true };
  }

  private async triggerAudioAnalyze(answerId: string, correlationId: string) {
    const flaskUrl = "url";
    const callbackUrl = "callback-url";

    // 실구현
  }

  // 4. feedback-gate
  // refine, rubric 둘 다 준비되어야 실행
  private async handleFeedbackGate(
    job: Job<{ sessionId: string; answerId: string }>,
  ) {
    const { sessionId, answerId } = job.data;

    // refine 준비 여부
    const analysis = await this.getAnalysis(answerId);
    const refineReady = !!analysis?.refined_json;

    // rubric 준비 여부
    const rubricReady = await this.isRubricReady(sessionId);

    // check
    if (!refineReady || !rubricReady) {
      await job.moveToDelayed(Date.now() + 30_000);
      return { waiting: true, refineReady, rubricReady };
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
}
