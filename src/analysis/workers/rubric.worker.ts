import { Injectable, Logger } from "@nestjs/common";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";

import { DataSource } from "typeorm";
import { InterviewSession, SessionQuestion } from "@/common/entities/entities";
import { AnalysisService } from "../services/analysis.service";
import { GenerateRubricDto } from "../analysis.dto";

@Injectable()
@Processor("rubric", { concurrency: 2 })
export class RubricWorker extends WorkerHost {
  private readonly logger = new Logger(RubricWorker.name);

  constructor(
    private readonly ds: DataSource,
    private readonly analysis: AnalysisService,
  ) {
    super();
  }
  async process(job: Job<any, any, string>): Promise<void> {
    switch (job.name) {
      case "generateRubric": {
        await this.generateRubric(job);
        return;
      }
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async generateRubric(job: Job<{ sessionId: string }>) {
    const { sessionId } = job.data;
    const sessionRepo = this.ds.getRepository(InterviewSession);
    const sqRepo = this.ds.getRepository(SessionQuestion);

    const session = await sessionRepo.findOne({
      where: { id: sessionId },
      relations: ["session_questions", "request", "session_questions.question"],
    });
    this.logger.debug(`1. find session ${sessionId}`);

    if (!session) {
      this.logger.warn(`Session not found: ${sessionId}`);
      return;
    }

    if (session.rubric_gen_status === "completed") return;

    await sessionRepo.update(sessionId, { rubric_gen_status: "processing" });
    await job.updateProgress(10);
    this.logger.debug(`2. job.updateProgress(10)`);

    // 실제 호출.
    try {
      const result = await this.callGPT(session);

      // 트랜잭션
      await this.ds.transaction(async (tr) => {
        await tr
          .getRepository(InterviewSession)
          .update(sessionId, { rubric_json: result.rubric });

        for (const sq of session.session_questions) {
          const matched = result.rubric.find((r) => r.id === sq.id) || null;

          await tr.getRepository(SessionQuestion).update(
            { id: sq.id },
            {
              rubric_status: matched ? "completed" : "failed",
              rubric_json: matched,
              rubric_last_error: matched ? null : "No matching rubric item",
            },
          );
        }
      });

      await sessionRepo.update(sessionId, {
        rubric_gen_status: "completed",
        rubric_last_error: null,
      });
      await job.updateProgress(100);
    } catch (error) {
      await sessionRepo.update(sessionId, {
        rubric_gen_status: "failed",
        rubric_last_error: "rubric 생성에 실패했습니다.",
      });
      throw error;
    }
  }

  private async callGPT(session: InterviewSession) {
    const dto: GenerateRubricDto = {
      vectorId: session.request.vector_id,
      questionList: session.session_questions.map((sq) => ({
        id: sq.id,
        text: sq.question.text,
      })),
    };

    const res = await this.analysis.generateRubric(dto);

    this.logger.debug(`3. GPT 응답 완료`);
    return res;
  }

  @OnWorkerEvent("active")
  onActive(job: Job) {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}.`);
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job) {
    this.logger.debug(`Completed job ${job.id} of type ${job.name}.`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `Failed job ${job.id} of type ${job.name}: ${err.message}`,
      err.stack,
    );
  }
}
