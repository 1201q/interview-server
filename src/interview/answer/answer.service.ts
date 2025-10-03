import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { DataSource, Repository } from "typeorm";
import {
  Answer,
  AnswerAnalysis,
  SessionQuestion,
} from "../../common/entities/entities";
import { SessionQuestionService } from "../question/question.service";
import { InterviewSessionService } from "../session/session.service";
import { FollowupService } from "../followup/followup.service";
import { SubmitAnswerResponseDto } from "./answer.dto";
import { FlaskServerService } from "src/external-server/flask-server.service";
import { OciDBService } from "src/external-server/oci-db.service";
import { SttProducer } from "@/analysis/producer/stt.producer";

type SubmitAnswerInput = {
  sessionId: string;
  sQuestionId: string;
  text: string;
  audio?: Express.Multer.File | null;
  decideFollowup?: boolean;
};

@Injectable()
export class InterviewAnswerService {
  private readonly logger = new Logger(InterviewAnswerService.name);

  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Answer)
    private readonly answerRepo: Repository<Answer>,

    private readonly questionService: SessionQuestionService,
    private readonly sessionService: InterviewSessionService,
    private readonly followupService: FollowupService,

    private readonly flaskService: FlaskServerService,
    private readonly ociUploadService: OciDBService,

    private readonly sttProducer: SttProducer,
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
    input: SubmitAnswerInput,
  ): Promise<SubmitAnswerResponseDto> {
    const {
      sessionId,
      sQuestionId,
      text,
      audio,
      decideFollowup = false,
    } = input;

    let objectName: string | undefined;

    // 1. 음성은 트랜잭션 바깥에서 전처리/업로드
    if (audio) {
      const seekable = await this.flaskService.convertToSeekableWebm(audio);
      objectName = await this.ociUploadService.uploadFileFromBuffer(
        seekable,
        `seekable-${audio.originalname}`,
      );
    }

    let submittedAnswerId: string | null = null;
    let needEnqueueSTT = false;

    const result = await this.dataSource.transaction<SubmitAnswerResponseDto>(
      async (manager) => {
        const answerRepo = manager.getRepository(Answer);
        const sqRepo = manager.getRepository(SessionQuestion);

        // 2. 제출 대상 Answer의 세션까지 확인하여 잠금 (중복 제출/경합 방지)
        const answer = await answerRepo.findOne({
          where: {
            session_question: { id: sQuestionId, session: { id: sessionId } },
          },
          relations: [
            "session_question",
            "session_question.session",
            "session_question.question",
          ],
          lock: { mode: "pessimistic_write" },
        });

        if (!answer) throw new NotFoundException("해당 answer가 없습니다.");

        // 3. 상태 전이 허용 범위 확인
        if (
          !["waiting", "answering", "ready", "submitted"].includes(
            answer.status,
          )
        ) {
          throw new BadRequestException(
            "해당 answer 상태에서는 제출할 수 없습니다.",
          );
        }

        if (answer.status === "submitted") {
        } else {
          // 4. Answer 업데이트
          const endedAt = new Date();
          await answerRepo.update(answer.id, {
            status: "submitted",
            text,
            ended_at: endedAt,
            ...(objectName ? { audio_path: objectName } : {}),
          });
        }

        submittedAnswerId = answer.id;

        // 5. AnswerAnalysis upsert(+ 초기화)
        const analysisRepo = manager.getRepository(AnswerAnalysis);
        let analysis = await analysisRepo.findOne({
          where: { answer: { id: answer.id } },
          lock: { mode: "pessimistic_write" },
        });

        if (!analysis) {
          analysis = analysisRepo.create({ answer, status: "pending" });
          await analysisRepo.save(analysis);
        } else {
          analysis.status = "pending";
          analysis.last_error = null;
          analysis.feedback_json = null;
          analysis.stt_json = null;
          analysis.refined_json = null;
          analysis.voice_json = null;
          await analysisRepo.save(analysis);
        }

        // 6. 꼬리질문 판별
        if (decideFollowup) {
          try {
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
          } catch (error) {
            this.logger.warn(`꼬리질문 생성 중 오류 발생: ${error.message}`);
          }
        }

        // 7. 다음 질문 조회
        const nextQuestion = await this.questionService.getNext(
          manager,
          sessionId,
        );

        if (nextQuestion) {
          // 다음 질문 answer를 조회. ready로 변경
          const nextAnswer = await answerRepo.findOne({
            where: { session_question: { id: nextQuestion.id } },
            lock: { mode: "pessimistic_write" },
          });

          if (nextAnswer && nextAnswer.status === "waiting") {
            await answerRepo.update(nextAnswer.id, { status: "ready" });
          }

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
          await this.sessionService.finishSession(manager, sessionId);
          return { next: null, finished: true };
        }
      },
    );

    if (submittedAnswerId) {
      needEnqueueSTT = true;
    }

    if (needEnqueueSTT && submittedAnswerId) {
      try {
        await this.sttProducer.enqueueSTT(submittedAnswerId);
      } catch (error) {
        this.logger.error(`STT 작업 큐잉 중 오류 발생: ${error.message}`);
      }
    }

    return result;
  }
}
