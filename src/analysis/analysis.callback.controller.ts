import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { InjectRepository } from "@nestjs/typeorm";
import { AnswerAnalysis } from "@/common/entities/entities";
import { Repository } from "typeorm";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";

@ApiTags("분석 콜백")
@Controller("analysis/callback")
export class AnalysisCallbackController {
  constructor(
    @InjectQueue("analysis") private readonly queue: Queue,

    @InjectRepository(AnswerAnalysis)
    private readonly repo: Repository<AnswerAnalysis>,
  ) {}

  @Post()
  async audioCallback(
    @Body() body: { correlationId: string; answerId: string; voice: any },
  ) {
    await this.repo
      .createQueryBuilder()
      .update(AnswerAnalysis)
      .set({ voice_json: body.voice })
      .where("answer_id = :answerId", { answerId: body.answerId })
      .execute();

    const job = await Job.fromId(this.queue, body.correlationId);

    if (job) {
      await job.promote();
    }

    return { ok: true };
  }
}
