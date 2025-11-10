import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { DataSource, EntityManager, Repository } from "typeorm";
import {
  Answer,
  AnswerAnalysis,
  InterviewSession,
} from "../../common/entities/entities";
import {
  CreateInterviewSessionDto,
  SessionDetailDto,
  SessionResponseDto,
  SessionRubricDto,
} from "./session.dto";
import { SessionQuestionService } from "../question/question.service";
import { ConfigService } from "@nestjs/config";
import { SessionPrepFlowService } from "@/analysis/session-prep.flow.service";

@Injectable()
export class InterviewSessionService {
  private readonly logger = new Logger(InterviewSessionService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly questionService: SessionQuestionService,

    private readonly sessionPrepFlow: SessionPrepFlowService,

    @InjectRepository(InterviewSession)
    private readonly sessionRepo: Repository<InterviewSession>,

    @InjectRepository(Answer)
    private readonly answerRepo: Repository<Answer>,
  ) {}

  async createSession(
    dto: CreateInterviewSessionDto,
  ): Promise<SessionResponseDto> {
    let createdSessionId: string;

    const result = await this.dataSource.transaction(async (manager) => {
      // 1. 세션 생성
      const session = manager.create(InterviewSession, {
        user_id: dto.user_id,
        status: "not_started",
        request: { id: dto.request_id },
      });
      await manager.save(session);
      createdSessionId = session.id;

      // 2. sQuestion 생성.
      const sessionQuestions = await this.questionService.bulkCreateQuestions(
        session,
        dto.questions,
        manager,
      );

      // 3. answer 생성
      const answerRepo = manager.getRepository(Answer);
      const answers = sessionQuestions.map((sq) =>
        answerRepo.create({ session_question: sq, status: "waiting" }),
      );
      const savedAnswers = await answerRepo.save(answers);

      // 4. answerAnalysis 생성
      const analysisRepo = manager.getRepository(AnswerAnalysis);
      const analyses = savedAnswers.map((ans) =>
        analysisRepo.create({
          answer: ans,
          status: "pending",
          feedback_json: null,
          stt_json: null,
          refined_json: null,
          voice_json: null,
          last_error: null,
        }),
      );

      await analysisRepo.save(analyses);

      return { session_id: session.id };
    });

    // 5. 커밋 후 큐 발행
    try {
      await this.sessionPrepFlow.start(createdSessionId!);
    } catch (error) {
      this.logger.warn(`enqueue GenerateRubric failed: ${error}`);
    }

    return result;
  }

  async getSessionDetail(
    id: string,
    userId: string,
  ): Promise<SessionDetailDto> {
    const session = await this.sessionRepo.findOne({
      where: { id, user_id: userId },
      relations: [
        "session_questions",
        "session_questions.question",
        "session_questions.answers",
        "session_questions.answers.analysis",
      ],
    });

    if (!session) {
      throw new NotFoundException("세션을 찾을 수 없습니다.");
    }

    return {
      session_id: session.id,
      status: session.status,
      created_at: session.created_at.toISOString(),
      questions: session.session_questions.map((sq) => ({
        id: sq.id,
        question_id: sq.question.id ?? null,
        answer_id: sq.answers[0].id ?? null,
        order: sq.order,
        type: sq.type,
        text: sq.type === "main" ? sq.question.text : sq.followup_text,
        status: sq.answers[0]?.status ?? "waiting",
      })),
    };
  }

  async getSessionRubric(
    id: string,
    userId: string,
  ): Promise<SessionRubricDto> {
    const session = await this.sessionRepo.findOne({
      where: { id, user_id: userId },
      relations: ["session_questions"],
    });

    if (!session) {
      throw new NotFoundException("세션을 찾을 수 없습니다.");
    }

    return {
      session_id: session.id,
      rubric_gen_status: session.rubric_gen_status,
      rubric_json: session.rubric_json,
      rubric_error: session.rubric_last_error ?? null,
    };
  }

  async startSession(
    sessionId: string,
    userId: string,
  ): Promise<SessionResponseDto> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, user_id: userId },
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

    return { session_id: session.id };
  }

  async finishSession(
    manager: EntityManager,
    sessionId: string,
  ): Promise<SessionResponseDto> {
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

    return { session_id: session.id };
  }

  // reset
  async resetSession(
    sessionId: string,
    userId: string,
  ): Promise<SessionResponseDto> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, user_id: userId },
      relations: ["session_questions", "session_questions.answers"],
    });

    if (!session) {
      throw new NotFoundException("세션을 찾을 수 없습니다.");
    }

    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(InterviewSession)
        .update(session.id, { status: "not_started" });

      const analysisRepo = manager.getRepository(AnswerAnalysis);

      for (const sq of session.session_questions) {
        for (const ans of sq.answers ?? []) {
          await manager.getRepository(Answer).update(ans.id, {
            status: "waiting",
            audio_path: null,
            text: null,
            started_at: null,
            ended_at: null,
          });

          await analysisRepo.update(
            { answer: { id: ans.id } },
            {
              status: "pending",
              feedback_json: null,
              stt_json: null,
              refined_json: null,
              voice_json: null,
              last_error: null,
            },
          );
        }
      }
    });

    return { session_id: session.id };
  }
}
