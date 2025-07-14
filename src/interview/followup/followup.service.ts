import { Injectable } from "@nestjs/common";

import { LangChainService } from "src/interview/followup/langchain.service";
import { Answer, SessionQuestion } from "../../common/entities/entities";
import { EntityManager, LessThanOrEqual } from "typeorm";

@Injectable()
export class FollowupService {
  constructor(private readonly langchain: LangChainService) {}

  async decideFollowupText(
    manager: EntityManager,
    sessionId: string,
    parent: SessionQuestion,
  ): Promise<string | null> {
    const answerRepo = manager.getRepository(Answer);
    const prev = await answerRepo.find({
      where: {
        session_question: {
          session: { id: sessionId },
          order: LessThanOrEqual(parent.order),
        },
        status: "submitted",
      },
      relations: ["session_question", "session_question.question"],
      order: { session_question: { order: "ASC" } },
    });

    const history = prev
      .map((answer) => {
        const q = answer.session_question;
        const questionText =
          q.type === "main" ? q.question.text : q.followup_text;

        return `Q. ${questionText}\nA. ${answer.text}`;
      })
      .join("\n\n");

    console.log(parent);

    const result = await this.langchain.generateFollowup({
      original_question:
        parent.type === "main" ? parent.question.text : parent.followup_text,
      current_answer: prev.slice(-1)[0]?.text ?? "",
      qa_history: history,
      requestId: parent.session.request.vector_id,
    });

    return result.result === "SKIP" ? null : result.question;
  }
}
