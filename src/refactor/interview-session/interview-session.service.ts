import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { DataSource, EntityManager, Repository } from "typeorm";
import { Answer, InterviewSession } from "../entities/entities";
import {
  CreateInterviewSessionDto,
  InterviewSessionDetailDto,
} from "./interview-session.dto";
import { SessionQuestionService } from "../session-question/session-question.service";

@Injectable()
export class InterviewSessionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly questionService: SessionQuestionService,

    @InjectRepository(InterviewSession)
    private readonly sessionRepo: Repository<InterviewSession>,

    @InjectRepository(Answer)
    private readonly answerRepo: Repository<Answer>,
  ) {}

  async createSession(dto: CreateInterviewSessionDto) {
    return this.dataSource.transaction(async (manager) => {
      // 1. 세션 생성
      const session = manager.create(InterviewSession, {
        user_id: dto.user_id,
        status: "not_started",
        request: { id: dto.request_id },
      });

      await manager.save(session);

      // 2. session Question 생성.
      const sessionQuestions = await this.questionService.bulkCreateQuestions(
        session,
        dto.questions,
        manager,
      );

      // 3. answer 생성
      const answerRepo = manager.getRepository(Answer);
      const answers = sessionQuestions.map((sq) =>
        answerRepo.create({
          session_question: sq,
          status: "waiting",
        }),
      );

      await answerRepo.save(answers);

      return { id: session.id, status: session.status };
    });
  }

  async getSessionDetail(id: string): Promise<InterviewSessionDetailDto> {
    const session = await this.sessionRepo.findOne({
      where: { id },
      relations: [
        "session_questions",
        "session_questions.question",
        "session_questions.answers",
        "session_questions.answers.analyses",
      ],
    });

    if (!session) {
      throw new NotFoundException("세션을 찾을 수 없습니다.");
    }

    return {
      id: session.id,
      status: session.status,
      created_at: session.created_at.toISOString(),
      questions: session.session_questions.map((sq) => ({
        id: sq.id,
        order: sq.order,
        type: sq.type,
        text: sq.type === "main" ? sq.question.text : sq.followup_text,
        status: sq.answers[0]?.status ?? "waiting",
        answer: sq.answers[0]?.text ?? null,
      })),
    };
  }

  async listSessions(userId: string) {
    const sessions = await this.sessionRepo.find({
      where: { user_id: userId },
      order: { created_at: "DESC" },
    });

    return sessions.map((s) => ({
      id: s.id,
      status: s.status,
      created_at: s.created_at.toISOString(),
    }));
  }

  async startSession(sessionId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ["session_questions", "session_questions.answers"],
    });

    if (!session) {
      throw new NotFoundException("세션을 찾을 수 없습니다.");
    }

    if (session.status !== "not_started") {
      throw new Error("이미 세션이 시작되었습니다.");
    }

    session.status = "in_progress";
    await this.sessionRepo.save(session);

    const firstQuestion = session.session_questions.sort(
      (a, b) => a.order - b.order,
    )[0];

    const firstAnswers = firstQuestion.answers[0];

    if (firstAnswers) {
      await this.answerRepo.update(firstAnswers.id, { status: "ready" });
    }

    return { id: session.id, status: session.status };
  }

  async finishSession(manager: EntityManager, sessionId: string) {
    const repo = manager.getRepository(InterviewSession);

    const session = await repo.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException("세션을 찾을 수 없습니다.");
    }

    if (session.status !== "in_progress") {
      throw new Error("진행 중인 세션만 종료할 수 있습니다.");
    }

    await repo.update(sessionId, { status: "completed" });
  }
}
