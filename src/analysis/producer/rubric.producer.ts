import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Injectable()
export class RubricProducer {
  private readonly logger = new Logger(RubricProducer.name);
  constructor(@InjectQueue("rubric") private readonly queue: Queue) {}

  async enqueueGenerateRubric(sessionId: string) {
    const jobId = `rubric:${sessionId}:v1`;
    const exists = await this.queue.getJob(jobId);

    if (exists) {
      this.logger.debug(`Job already exists: ${jobId}`);
      return exists;
    }

    return this.queue.add(
      "generateRubric", // job 이름
      { sessionId },
      {
        jobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
        priority: 1,
      },
    );
  }
}
