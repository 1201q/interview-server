import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { DataSource, Repository } from "typeorm";
import { Answer } from "../entities/entities";
import { SessionQuestionService } from "../session-question/session-question.service";
import { InterviewSessionService } from "../interview-session/interview-session.service";
import { FollowupService } from "../followup/followup.service";

@Injectable()
export class InterviewAnswerService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Answer)
    private readonly answerRepo: Repository<Answer>,

    private readonly questionService: SessionQuestionService,
    private readonly sessionService: InterviewSessionService,
    private readonly followupService: FollowupService,
  ) {}

  async startAnswer(sessionId: string, questionId: string): Promise<void> {
    const answer = await this.answerRepo.findOne({
      where: {
        session_question: { id: questionId, session: { id: sessionId } },
      },
    });

    if (!answer) {
      throw new NotFoundException("answer를 찾을 수 없음.");
    }

    if (answer.status !== "ready") {
      throw new BadRequestException("answer가 ready 상태가 아닙니다.");
    }

    await this.answerRepo.update(answer.id, {
      status: "answering",
      started_at: new Date(),
    });
  }

  async submitAnswer(
    sessionId: string,
    questionId: string,
    audioPath: string,
    text: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const answerRepo = manager.getRepository(Answer);

      // 1. 제출할 answer 검색 -> 업데이트
      const answer = await answerRepo.findOne({
        where: {
          session_question: { id: questionId, session: { id: sessionId } },
        },
        relations: ["session_question"],
      });

      if (!answer) {
        throw new NotFoundException("해당 answer가 없습니다.");
      }

      // 해당 answer 변경 사항 업데이트
      await answerRepo.update(answer.id, {
        status: "submitted",
        text,
        audio_path: audioPath,
        ended_at: new Date(),
      });

      const followupText = await this.followupService.decideFollowupText(
        manager,
        sessionId,
        answer.session_question,
      );

      if (followupText) {
        await this.questionService.createFollowUp(
          manager,
          answer.session_question,
          followupText,
        );
      }

      const nextQuestion = await this.questionService.getNext(
        manager,
        sessionId,
      );

      if (nextQuestion) {
        const nextAnswer = nextQuestion.answers[0];
        await manager
          .getRepository(Answer)
          .update(nextAnswer.id, { status: "ready" });
      } else {
        console.log("the end");
      }
    });
  }
}
