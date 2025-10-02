import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Injectable()
export class SttProducer {
  private readonly logger = new Logger(SttProducer.name);
  constructor(@InjectQueue("stt") private readonly q: Queue) {}

  async enqueueSTT(answerId: string) {
    const jobId = `stt:${answerId}`;
    const exists = await this.q.getJob(jobId);
    if (exists) {
      this.logger.debug(`Job already exists: ${jobId}`);
      return exists;
    }
    return this.q.add(
      "stt",
      { answerId },
      {
        jobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
      },
    );
  }
}
