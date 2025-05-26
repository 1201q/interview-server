import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { InterviewSession } from "./entities/interview.session.entity";
import { In, Repository } from "typeorm";
import { InterviewSessionQuestion } from "./entities/interview.session.question.entity";
import { Question } from "src/question/entities/question.entity";

@Injectable()
export class InterviewService {
  constructor(
    @InjectRepository(InterviewSession)
    private sessionRepository: Repository<InterviewSession>,

    @InjectRepository(InterviewSessionQuestion)
    private sessionQuestionRepository: Repository<InterviewSessionQuestion>,

    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
  ) {}

  async createInterviewSession(
    userId: string,
    questions: { id: string; order: number }[],
  ) {
    const questionIds = questions.map((q) => q.id);

    // 임시
    if (questions.length < 1 || questions.length > 15) {
      throw new BadRequestException(
        "질문 개수는 1개 이상 15개 이하여야 합니다.",
      );
    }

    const findQuestions = await this.questionRepository.find({
      where: { id: In(questionIds) },
    });

    if (questionIds.length !== findQuestions.length) {
      throw new Error("not found");
    }

    // id, index
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    const newSession = this.sessionRepository.create({
      user_id: userId,
      status: "pending",
      questions: [],
    });

    const savedSession = await this.sessionRepository.save(newSession);

    const sessionQuestions = questions.map(({ id, order }) => {
      const question = questionMap.get(id);
      if (!question) throw new Error(`not found : ${id}`);

      return this.sessionQuestionRepository.create({
        session: savedSession,
        question,
        order,
        status: "waiting",
      });
    });

    await this.sessionQuestionRepository.save(sessionQuestions);

    return this.sessionRepository.findOne({
      where: { id: savedSession.id },
      relations: ["questions", "questions.question"],
      order: {
        questions: {
          order: "ASC",
        },
      },
    });
  }

  async getActiveSessionBySessionId(userId: string, sessionId: string) {
    return this.sessionRepository.findOne({
      where: {
        user_id: userId,
        id: sessionId,
      },
      relations: ["questions", "questions.question"],
      order: {
        questions: {
          order: "ASC",
        },
      },
    });
  }

  async expireSession(userId: string, sessionId: string) {
    await this.sessionRepository.update(
      { id: sessionId, user_id: userId },
      { status: "expired" },
    );
  }

  async readySession(userId: string, sessionId: string) {
    return this.sessionRepository.update(
      { id: sessionId, user_id: userId },
      { status: "ready" },
    );
  }

  // 세션의 상태를 in_progress로 바꿈.
  // 첫번째 질문의 상태를 ready로 바꿈.
  async startInterviewSession(userId: string, sessionId: string) {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, user_id: userId },
      relations: ["questions"],
      order: {
        questions: {
          order: "ASC",
        },
      },
    });

    if (!session) throw new Error("세션 검색 실패");

    session.status = "in_progress";
    await this.sessionRepository.save(session);

    const firstQuestion = session.questions[0];
    firstQuestion.status = "ready";

    await this.sessionQuestionRepository.save(firstQuestion);
  }

  async completeInterviewSession(userId: string, sessionId: string) {
    await this.sessionRepository.update(
      { id: sessionId, user_id: userId },
      { status: "completed" },
    );
  }

  async startAnswer(userId: string, sessionId: string, order: number) {
    const currentQuestion = await this.sessionQuestionRepository.findOne({
      where: {
        session: { id: sessionId, user_id: userId },
        order,
      },
      relations: ["session"],
    });

    if (!currentQuestion) throw new Error("질문 검색 실패");
    if (currentQuestion.status !== "ready") {
      throw new Error("해당 질문은 아직 시작할 수 없습니다.");
    }

    currentQuestion.status = "answering";
    currentQuestion.started_at = new Date();
    await this.sessionQuestionRepository.save(currentQuestion);
  }

  async submitAnswer(
    userId: string,
    sessionId: string,
    order: number,
    audioPath: string,
  ) {
    const currentQuestion = await this.sessionQuestionRepository.findOne({
      where: {
        session: { id: sessionId, user_id: userId },
        order,
      },
      relations: ["session"],
    });

    if (!currentQuestion) throw new Error("질문 검색 실패");

    currentQuestion.status = "submitted";
    currentQuestion.ended_at = new Date();
    currentQuestion.audio_path = audioPath;
    currentQuestion.analysis_status = "processing";

    await this.sessionQuestionRepository.save(currentQuestion);

    const nextQuestion = await this.sessionQuestionRepository.findOne({
      where: {
        session: { id: sessionId, user_id: userId },
        order: order + 1,
      },
    });

    if (!nextQuestion) {
      await this.sessionRepository.update(
        { id: sessionId },
        { status: "completed" },
      );

      return { isLastQuestion: true, questionId: currentQuestion.id };
    } else {
      nextQuestion.status = "ready";
      await this.sessionQuestionRepository.save(nextQuestion);

      return {
        isLastQuestion: false,
        questionId: currentQuestion.id,
        nextQuestionId: nextQuestion.id,
      };
    }
  }

  async completeAnalysis(questionId: string, result: any) {
    await this.sessionQuestionRepository.update(questionId, {
      analysis_result: JSON.stringify(result),
      analysis_status: "completed",
    });
  }

  async markAnalysisFailed(questionId: string) {
    await this.sessionQuestionRepository.update(questionId, {
      analysis_status: "failed",
    });
  }
}
