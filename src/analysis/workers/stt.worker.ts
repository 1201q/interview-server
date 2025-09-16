import { Injectable } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { AnswerAnalysisRepository } from "../repos/answer.analysis.repository";
import { GateService } from "../services/gate.service";

@Injectable()
@Processor("stt", { concurrency: 2 })
export class SttWorker extends WorkerHost {
  constructor(
    private readonly aaRepo: AnswerAnalysisRepository,
    private readonly gate: GateService,
  ) {
    super();
  }

  async process(job: Job<{ analysisId: string; answerId: string }>) {
    const { analysisId, answerId } = job.data;

    try {
      const stt = { text: "(demo) hello " };
      await this.aaRepo.upsertJson(analysisId, { stt_json: stt });
      await this.gate.tryComplete(analysisId);

      return { ok: true };
    } catch (error) {
      await this.aaRepo.setFailed(analysisId, error);
      throw error;
    }
  }
}
