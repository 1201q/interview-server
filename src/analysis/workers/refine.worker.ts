import { Injectable } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { AnswerAnalysisRepository } from "../repos/answer.analysis.repository";
import { GateService } from "../services/gate.service";

@Injectable()
@Processor("refine", { concurrency: 2 })
export class RefineWorker extends WorkerHost {
  constructor(
    private readonly aaRepo: AnswerAnalysisRepository,
    private readonly gate: GateService,
  ) {
    super();
  }

  async process(job: Job<{ analysisId: string }>) {
    const { analysisId } = job.data;

    try {
      const refined = { text: "(demo) refined " };
      await this.aaRepo.upsertJson(analysisId, { refined_words_json: refined });
      await this.gate.tryComplete(analysisId);

      return { ok: true };
    } catch (error) {
      await this.aaRepo.setFailed(analysisId, error);
      throw error;
    }
  }
}
