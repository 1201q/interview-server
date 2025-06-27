import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { In, Repository } from "typeorm";

import { NewInterviewSession } from "../entities/new.interview.session.entity";
import { NewInterviewAnswer } from "../entities/new.interview.answer.entity";
import { GeneratedQuestionItem } from "src/question-generator/entities/generated.question.items.entity";
import { QuestionGenerationRequest } from "src/question-generator/entities/question.generation.request";

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(QuestionGenerationRequest)
    private questionGenerationReqRepo: Repository<QuestionGenerationRequest>,

    @InjectRepository(GeneratedQuestionItem)
    private generatedQuestionItemRepo: Repository<GeneratedQuestionItem>,

    @InjectRepository(NewInterviewSession)
    private interviewSessionRepo: Repository<NewInterviewSession>,

    @InjectRepository(NewInterviewAnswer)
    private interviewAnswerRepo: Repository<NewInterviewAnswer>,
  ) {}

  async createInterviewSession(
    userId: string,
    requestId: string,
    questions: { id: string; order: number }[],
  ) {
    const questionIds = questions.map((q) => q.id);

    // 임시
    if (questions.length < 1 || questions.length > 15) {
      throw new BadRequestException(
        "질문 개수는 1개 이상 15개 이하여야 합니다.",
      );
    }

    const generationRequest = await this.questionGenerationReqRepo.findOneBy({
      id: requestId,
    });

    if (!generationRequest) {
      throw new BadRequestException("이력서 정보를 찾을 수 없습니다.");
    }

    const findQuestions = await this.generatedQuestionItemRepo.find({
      where: { id: In(questionIds) },
    });

    if (questionIds.length !== findQuestions.length) {
      throw new BadRequestException("일부 질문을 찾을 수 없습니다.");
    }

    // id, index
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    const newSession = this.interviewSessionRepo.create({
      user_id: userId,
      status: "pending",
      answers: [],
      request: generationRequest,
    });

    const savedSession = await this.interviewSessionRepo.save(newSession);

    const sessionQuestions = questions.map(({ id, order }) => {
      const question = questionMap.get(id);
      if (!question) throw new Error(`not found : ${id}`);

      return this.interviewAnswerRepo.create({
        session: savedSession,
        question,
        order,
        status: "waiting",
      });
    });

    const data = await this.interviewAnswerRepo.save(sessionQuestions);

    const result = await this.interviewSessionRepo.findOne({
      where: { id: savedSession.id },
      select: ["id"],
    });

    return result.id;
  }

  // 세션의 상태를 in_progress로 바꿈.
  // 첫번째 질문의 상태를 ready로 바꿈.
  async startInterviewSession(userId: string, sessionId: string) {
    const session = await this.interviewSessionRepo.findOneBy({
      id: sessionId,
      user_id: userId,
    });

    if (!session) throw new NotFoundException("세션이 미존재.");

    session.status = "in_progress";
    await this.interviewSessionRepo.save(session);

    const firstQuestion = await this.interviewAnswerRepo.findOne({
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
    await this.interviewAnswerRepo.save(firstQuestion);

    const totalCount = await this.interviewAnswerRepo.count({
      where: { session: { id: sessionId } },
    });

    return {
      question: {
        id: firstQuestion.id,
        text: firstQuestion.question.question,
        order: firstQuestion.order,
        section: firstQuestion.question.section,
      },
      totalCount: totalCount,
    };
  }

  async completeInterviewSession(userId: string, sessionId: string) {
    const session = await this.interviewSessionRepo.findOneBy({
      id: sessionId,
      user_id: userId,
    });

    if (!session) {
      throw new NotFoundException("세션을 찾을 수 없습니다.");
    }

    session.status = "completed";
    return await this.interviewSessionRepo.save(session);
  }
}
