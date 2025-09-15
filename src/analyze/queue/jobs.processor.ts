import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Job } from "bullmq";

@Processor("analysis")
export class JobProcessor extends WorkerHost {
  async process(job: Job<{ answerId: string; url: string }>) {
    switch (job.name) {
      case "audioAnalyze":
        await job.updateProgress(10);
        //
        await job.updateProgress(100);
        return { ok: true };
      default:
        throw new Error(`Unknown job: ${Job.name}`);
    }
  }

  @OnWorkerEvent("active")
  onActive(job: Job) {}

  @OnWorkerEvent("completed")
  onCompleted(job: Job, result: any) {}

  @OnWorkerEvent("failed")
  onFailed(job: Job, error: Error) {}
}
