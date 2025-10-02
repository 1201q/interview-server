import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { DataSource } from "typeorm";
import Redis from "ioredis";
import {
  Answer,
  AnswerAnalysis,
  SessionQuestion,
} from "@/common/entities/entities";

@Injectable()
@Processor("refine", { concurrency: 2 })
export class RefineWorker extends WorkerHost {
  private readonly logger = new Logger(RefineWorker.name);

  constructor(
    private readonly ds: DataSource,

    @InjectQueue("feedback") private readonly feedbackQ: Queue,
    @Inject("REDIS_CLIENT") private readonly redis: Redis,
  ) {
    super();
  }

  async process(job: Job<{ answerId: string }>) {
    const { answerId } = job.data;

    const test = await this.ds.getRepository(Answer).findOne({
      where: { id: answerId },
      relations: ["analyses"],
    });

    console.log(test.analyses);

    await this.ds.getRepository(AnswerAnalysis).save({
      answer: { id: answerId },
      refined_words_json: {} as any,
    });

    const ansRepo = this.ds.getRepository(Answer);
    const sqRepo = this.ds.getRepository(SessionQuestion);

    const answer = await ansRepo.findOne({
      where: { id: answerId },
      relations: ["session_question", "session_question.session"],
    });

    if (!answer) return;
    this.logger.debug(`Refine answer ID: ${answerId}`);

    const sessionId = answer.session_question.session.id;
    const rubricReady =
      answer.session_question.session.rubric_gen_status === "completed" &&
      answer.session_question.rubric_status === "completed";

    if (rubricReady) {
      this.logger.debug(`feedback start answer ID: ${answerId}`);

      await this.feedbackQ.add(
        "feedback",
        { answerId },
        {
          jobId: `feedback:${answerId}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: true,
        },
      );
    } else {
      await this.redis.sadd(`feedback:pending:${sessionId}`, answerId);
      this.logger.debug(`feedback deferred answer ID: ${answerId}`);
    }
  }
}
