import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { Between, EntityManager, MoreThan, Repository } from "typeorm";
import { InterviewSession, SessionQuestion } from "../entities/entities";

@Injectable()
export class SessionQuestionService {
  constructor(
    @InjectRepository(SessionQuestion)
    private readonly sessionQuestionRepo: Repository<SessionQuestion>,
  ) {}

  /* 
    세션 생성시 session_questions 생성
  */
  async bulkCreateQuestions(
    session: InterviewSession,
    questions: { question_id: string; order: number }[],
    manager: EntityManager,
  ): Promise<SessionQuestion[]> {
    const repo = manager.getRepository(SessionQuestion);

    const items = questions.map((q) =>
      repo.create({
        session,
        question: { id: q.question_id },
        order: q.order,
        type: "main",
      }),
    );

    return repo.save(items);
  }

  /* 
    다음 질문 가져옴
  */
  async getNextQuestion(
    sessionId: string,
    order: number,
  ): Promise<SessionQuestion | null> {
    return this.sessionQuestionRepo.findOne({
      where: {
        session: { id: sessionId },
        order: MoreThan(order),
      },
      order: { order: "ASC" },
    });
  }

  /* 
    꼬리 질문 생성
  */
  async addFollowup(
    parentQuestionId: string,
    followupText: string,
  ): Promise<SessionQuestion> {
    const parent = await this.sessionQuestionRepo.findOne({
      where: { id: parentQuestionId },
      relations: ["session"],
    });

    if (!parent)
      throw new NotFoundException("부모 question이 존재하지 않습니다.");

    const array = await this.sessionQuestionRepo.find({
      where: {
        session: { id: parent.session.id },
        order: Between(parent.order, parent.order + 1),
      },
      order: { order: "desc" },
    });

    const lastOrder = array.find((q) => q.order > parent.order)?.order;
    const nextOrder = lastOrder
      ? parseFloat((lastOrder + 0.1).toFixed(1))
      : parseFloat((parent.order + 0.1).toFixed(1));

    const followup = this.sessionQuestionRepo.create({
      session: parent.session,
      order: nextOrder,
      type: "followup",
      followup_text: followupText,
      parent,
    });

    return this.sessionQuestionRepo.save(followup);
  }
}
