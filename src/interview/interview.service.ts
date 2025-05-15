import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { v4 as uuidv4 } from "uuid";

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

    if (questions.length < 5 || questions.length > 15) {
      throw new BadRequestException(
        "질문 개수는 5개 이상 15개 이하여야 합니다.",
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

  async getActiveSessionByUserId(userId: string) {
    return this.sessionRepository.findOne({
      where: {
        user_id: userId,
        status: In(["pending", "ready", "in_progress"]),
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
    });
  }

  async expireSession(sessionId: string) {
    await this.sessionRepository.update(
      { id: sessionId },
      { status: "expired" },
    );
  }
}
