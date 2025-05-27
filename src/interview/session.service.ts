import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { InterviewSession } from "./entities/interview.session.entity";
import { In, Repository } from "typeorm";
import { InterviewSessionQuestion } from "./entities/interview.session.question.entity";
import { Question } from "src/question/entities/question.entity";

@Injectable()
export class SessionService {
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
  ): Promise<string> {
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

    const result = await this.sessionRepository.findOne({
      where: { id: savedSession.id },
      select: ["id"],
    });

    return result.id;
  }

  // 세션의 상태를 in_progress로 바꿈.
  // 첫번째 질문의 상태를 ready로 바꿈.
  async startInterviewSession(userId: string, sessionId: string) {
    const session = await this.sessionRepository.findOneBy({
      id: sessionId,
      user_id: userId,
    });

    if (!session) throw new NotFoundException("세션이 미존재.");

    session.status = "in_progress";
    await this.sessionRepository.save(session);

    const firstQuestion = await this.sessionQuestionRepository.findOne({
      where: {
        session: { id: sessionId },
      },
      order: {
        order: "ASC",
      },
    });

    if (!firstQuestion) {
      throw new NotFoundException("세션에 해당 질문이 없습니다.");
    }

    firstQuestion.status = "ready";
    await this.sessionQuestionRepository.save(firstQuestion);

    const totalCount = await this.sessionQuestionRepository.count({
      where: { session: { id: sessionId } },
    });

    return {
      question: {
        id: firstQuestion.id,
        text: firstQuestion.question.question_text,
        order: firstQuestion.order,
      },
      totalCount: totalCount,
    };
  }

  async completeInterviewSession(userId: string, sessionId: string) {
    const session = await this.sessionRepository.findOneBy({
      id: sessionId,
      user_id: userId,
    });

    if (!session) {
      throw new NotFoundException("세션을 찾을 수 없습니다.");
    }

    session.status = "completed";
    return await this.sessionRepository.save(session);
  }
}
