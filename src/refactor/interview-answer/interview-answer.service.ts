import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { DataSource, Repository } from "typeorm";
import { Answer, SessionQuestion } from "../entities/entities";
import { SessionQuestionService } from "../session-question/session-question.service";
import { InterviewSessionService } from "../interview-session/interview-session.service";
import { FollowupService } from "../followup/followup.service";
import { SubmitAnswerResponseDto } from "./interview-answer.dto";

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
  ): Promise<SubmitAnswerResponseDto> {
    const resultDto =
      await this.dataSource.transaction<SubmitAnswerResponseDto>(
        async (manager) => {
          const answerRepo = manager.getRepository(Answer);

          // 1. 제출할 answer 검색 -> 업데이트
          const answer = await answerRepo.findOne({
            where: {
              session_question: { id: questionId, session: { id: sessionId } },
            },
            relations: [
              "session_question",
              "session_question.question",
              "session_question.session.request",
            ],
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
            await manager
              .getRepository(Answer)
              .update(nextQuestion.answers[0].id, { status: "ready" });

            return {
              next: {
                questionId: nextQuestion.id,
                order: nextQuestion.order,
                text:
                  nextQuestion.type === "main"
                    ? nextQuestion.question.text
                    : nextQuestion.followup_text,
                type: nextQuestion.type,
              },
              finished: false,
            };
          } else {
            return {
              next: null,
              finished: true,
            };
          }
        },
      );

    return resultDto;
  }
}
