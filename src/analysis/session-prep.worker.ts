import { Processor, WorkerHost } from "@nestjs/bullmq";

import type { Job } from "bullmq";

import { DataSource, Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { Injectable, Logger } from "@nestjs/common";
import { InterviewSession, SessionQuestion } from "@/common/entities/entities";

import { GenerateRubricDto } from "./analysis.dto";
import { AnalysisEventsService } from "./analysis.events.service";
import { AnalysisAiService } from "./analysis-ai.service";

@Injectable()
@Processor("session", { concurrency: 4 })
export class SessionPrepWorker extends WorkerHost {
  private readonly logger = new Logger(SessionPrepWorker.name);

  constructor(
    private readonly ds: DataSource,

    @InjectRepository(InterviewSession)
    private readonly repo: Repository<InterviewSession>,

    private readonly ai: AnalysisAiService,
    private readonly events: AnalysisEventsService,
  ) {
    super();
  }

  private notifyStatusUpdate(sessionId: string) {
    this.events.emit(sessionId, {
      type: "status_update",
      session_id: sessionId,
    });
  }

  private async getRubricDto(sessionId: string): Promise<GenerateRubricDto> {
    const session = await this.repo.findOne({
      where: { id: sessionId },
      relations: ["session_questions", "session_questions.question", "request"],
    });

    const dto = new GenerateRubricDto();
    dto.vectorId = session.request.vector_id;
    dto.questionList = session.session_questions.map((sq) => ({
      text: sq.question.text,
      id: sq.id,
    }));

    return dto;
  }

  private async getJobText(sessionId: string) {
    const session = await this.repo.findOne({
      where: { id: sessionId },
      relations: ["request"],
    });

    return session.request.job_text;
  }

  async process(job: Job, token?: string) {
    switch (job.name) {
      case "role-guess":
        return this.handleRole(job);
      case "rubric-all":
        return this.handleRubric(job);
      case "session-root":
        return this.handleParent(job);
      default:
        throw new Error("Unknown job name: " + job.name);
    }
  }

  private async handleRole(job: Job<{ sessionId: string }>) {
    const { sessionId } = job.data;

    const jobText = await this.getJobText(sessionId);

    this.logger.debug(`Role guess for session ${sessionId}`);

    const guess = await this.ai.guessRole(jobText);
    await this.repo
      .createQueryBuilder()
      .update(InterviewSession)
      .set({
        role_guess: guess,
      })
      .where("id = :id", { id: sessionId })
      .execute();

    this.logger.debug(`guess 완료: ${sessionId} ${guess}`);

    this.notifyStatusUpdate(sessionId);
    await job.updateProgress(100);
    return { ok: true, sessionId };
  }

  private async handleRubric(job: Job<{ sessionId: string }>) {
    const { sessionId } = job.data;

    const dto = await this.getRubricDto(sessionId);

    this.logger.debug(`Rubric generation for session ${sessionId}`);
    const data = await this.ai.generateRubric(dto);
    const rubric = data.rubric;

    this.logger.debug(`Rubric generation completed: ${sessionId}`);

    await this.repo
      .createQueryBuilder()
      .update(InterviewSession)
      .set({
        rubric_json: rubric,
        rubric_gen_status: "completed",
      })
      .where("id = :id", { id: sessionId })
      .execute();

    const sqRepo = this.ds.getRepository(SessionQuestion);

    const questions = await sqRepo.find({
      where: { session: { id: sessionId } },
      select: ["id"],
      relations: ["question"],
    });

    const _getRubricForSQ = (sq: SessionQuestion) => {
      const data = rubric.find((r) => r.id === sq.id);
      if (data) return data;
    };

    for (const sq of questions) {
      const item = _getRubricForSQ(sq);

      if (!item) {
        await sqRepo
          .createQueryBuilder()
          .update(SessionQuestion)
          .set({
            rubric_status: "failed",
          })
          .where("id = :id", { id: sq.id })
          .execute();
      } else {
        await sqRepo
          .createQueryBuilder()
          .update(SessionQuestion)
          .set({
            rubric_json: item,
            rubric_status: "completed",
          })
          .where("id = :id", { id: sq.id })
          .execute();
      }
    }

    this.logger.debug(`Rubric saved to DB: ${sessionId}`);

    this.notifyStatusUpdate(sessionId);
    await job.updateProgress(100);
    return { ok: true, sessionId };
  }

  private async handleParent(job: Job<{ sessionId: string }>) {
    await job.updateProgress(100);
    return { ok: true };
  }
}
