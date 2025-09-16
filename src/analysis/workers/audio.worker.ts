import { Injectable } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";

import { ConfigService } from "@nestjs/config";

@Injectable()
@Processor("audio", { concurrency: 1 })
export class AudioWorker extends WorkerHost {
  constructor(private readonly cfg: ConfigService) {
    super();
  }

  async process(job: Job<{ analysisId: string; answerId: string }>) {
    const { analysisId, answerId } = job.data;

    const callbackURL = "";
    return { enqueued: true, analysisId, answerId, callbackURL };
  }
}
