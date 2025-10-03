import { Injectable } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";

@Injectable()
@Processor("feedback", { concurrency: 2 })
export class FeedbackWorker extends WorkerHost {
  constructor() {
    super();
  }

  async process(job: Job<{ analysisId: string }>) {}
}
