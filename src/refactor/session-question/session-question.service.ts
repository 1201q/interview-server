import { Injectable } from "@nestjs/common";

import { EntityManager } from "typeorm";
import {
  Answer,
  InterviewSession,
  SessionQuestion,
} from "../entities/entities";

@Injectable()
export class SessionQuestionService {
  constructor() {}

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

  // 꼬리질문 DB 삽입 + 빈 answer를 생성.
  async createFollowUp(
    manager: EntityManager,
    parent: SessionQuestion,
    followupText: string,
  ): Promise<SessionQuestion> {
    const questionRepo = manager.getRepository(SessionQuestion);
    const answerRepo = manager.getRepository(Answer);

    const newQuestion = questionRepo.create({
      session: parent.session,
      type: "followup",
      followup_text: followupText,
      parent,
      order: parseFloat((parent.order + 0.1).toFixed(1)),
    });

    await questionRepo.save(newQuestion);

    await answerRepo.save(
      answerRepo.create({
        session_question: newQuestion,
        status: "waiting",
      }),
    );

    return newQuestion;
  }

  async getNext(
    manager: EntityManager,
    sessionId: string,
  ): Promise<SessionQuestion | null> {
    return manager.getRepository(SessionQuestion).findOne({
      where: {
        session: { id: sessionId },
        answers: { status: "ready" },
      },
      relations: ["question", "answers"],
      order: { order: "ASC" },
    });
  }
}
