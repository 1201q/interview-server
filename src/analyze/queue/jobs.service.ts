// queue/jobs.service.ts
import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Injectable()
export class JobsService {
  constructor(@InjectQueue("analysis") private readonly q: Queue) {}

  async enqueueAnalyze(payload: { answerId: string; url: string }) {
    return this.q.add("audioAnalyze", payload);
  }
}
