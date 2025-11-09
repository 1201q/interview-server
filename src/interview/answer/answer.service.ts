import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { DataSource, EntityManager, Repository } from "typeorm";
import { Answer, AnswerAnalysis } from "../../common/entities/entities";
import { SessionQuestionService } from "../question/question.service";
import { InterviewSessionService } from "../session/session.service";

import { SubmitAnswerResponseDto } from "./answer.dto";
import { FlaskServerService } from "src/external-server/flask-server.service";
import { OciDBService } from "src/external-server/oci-db.service";
import { AnalysisFlowService } from "@/analysis/analysis.flow.service";
import { FaceFrameState } from "@/common/types/analysis.types";

type SubmitAnswerInput = {
  answerId: string;
  text: string;
  audio?: Express.Multer.File | null;
  decideFollowup?: boolean;
  faceData?: FaceFrameState[] | null;
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

    private readonly analysisFlow: AnalysisFlowService,

    private readonly flaskService: FlaskServerService,
    private readonly ociUploadService: OciDBService,
  ) {}

  // 답변 시작
  async startAnswer(answerId: string): Promise<void> {
    const answer = await this.answerRepo.findOneOrFail({
      where: { id: answerId },
    });

    this.checkCanStart(answer);

    await this.answerRepo.update(answer.id, {
      status: "answering",
      started_at: new Date(),
    });
  }

  // answerId 제출
  async testsubmitAnswer(
    input: SubmitAnswerInput,
  ): Promise<SubmitAnswerResponseDto> {
    const { answerId, text, audio, decideFollowup = false, faceData } = input;

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
    let sessionId: string | null = null;

    const result = await this.dataSource.transaction<SubmitAnswerResponseDto>(
      async (manager) => {
        const answerRepo = manager.getRepository(Answer);

        // 2. 제출 대상 Answer
        const answer = await answerRepo.findOneOrFail({
          where: { id: answerId },
          relations: [
            "session_question",
            "session_question.session",
            "session_question.question",
          ],
        });

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
        sessionId = answer.session_question.session.id;

        // 5. AnswerAnalysis upsert(+ 초기화)
        const analysisRepo = manager.getRepository(AnswerAnalysis);
        let analysis = await analysisRepo.findOne({
          where: { answer: { id: answer.id } },
        });

        if (!analysis) {
          analysis = analysisRepo.create({
            answer,
            status: "pending",
            face_json: faceData,
          });
          await analysisRepo.save(analysis);
        } else {
          analysis.status = "pending";
          analysis.last_error = null;
          analysis.feedback_json = null;
          analysis.stt_json = null;
          analysis.refined_json = null;
          analysis.voice_json = null;
          analysis.face_json = faceData;
          await analysisRepo.save(analysis);
        }

        // // 6. 꼬리질문 판별
        // if (decideFollowup) {
        //   try {
        //     const followupText = await this.followupService.decideFollowupText(
        //       manager,
        //       sessionId,
        //       answer.session_question,
        //     );

        //     if (followupText) {
        //       await this.questionService.createFollowUp(
        //         manager,
        //         answer.session_question,
        //         followupText,
        //       );
        //     }
        //   } catch (error) {
        //     this.logger.warn(`꼬리질문 생성 중 오류 발생: ${error.message}`);
        //   }
        // }

        // 7. 다음 질문 조회
        const nextQuestion = await this.questionService.getNext(
          manager,
          sessionId,
        );

        if (nextQuestion) {
          // 다음 질문 answer를 조회. ready로 변경
          const nextAnswer = await answerRepo.findOne({
            where: { session_question: { id: nextQuestion.id } },
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
              answerId: nextAnswer ? nextAnswer.id : null,
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
        await this.analysisFlow.addFullFlow({
          answerId: submittedAnswerId,
          sessionId: sessionId,
        });
      } catch (error) {
        this.logger.error(`STT 작업 큐잉 중 오류 발생: ${error.message}`);
      }
    }

    return result;
  }

  async submitAnswer(
    input: SubmitAnswerInput,
  ): Promise<SubmitAnswerResponseDto> {
    const { answerId, text, audio, decideFollowup = false, faceData } = input;

    // 트랜잭션 밖 ==========

    //  음성 전처리 및 업로드
    const objectName = await this.processAndUploadAudio(audio);

    let submittedAnswerId: string | null = null;
    let sessionId: string | null = null;

    // 트랜잭션 안 ==========
    const { next, finished } =
      await this.dataSource.transaction<SubmitAnswerResponseDto>(
        async (manager) => {
          const answerRepo = manager.getRepository(Answer);
          const answer = await answerRepo.findOneOrFail({
            where: { id: answerId },
            relations: [
              "session_question",
              "session_question.session",
              "session_question.question",
            ],
          });

          submittedAnswerId = answer.id;

          // 제출 핵심 로직
          const result = await this.submitCore(manager, answer, {
            text,
            objectName,
            faceData,
          });

          // 트랜잭션 바깥 처리를 위한 값 설정
          sessionId = result.sessionId;

          return {
            next: result.next,
            finished: result.finished,
          };
        },
      );

    // 트랜잭션 밖 ==========

    if (submittedAnswerId && sessionId) {
      try {
        await this.analysisFlow.addFullFlow({
          answerId: submittedAnswerId,
          sessionId,
        });
      } catch (error) {
        this.logger.error(`STT 작업 큐잉 중 오류 발생: ${error.message}`);
      }
    }

    return { next, finished };
  }

  // 음성 전처리 및 업로드
  private async processAndUploadAudio(
    audio?: Express.Multer.File | null,
  ): Promise<string | undefined> {
    if (!audio) return;

    const seekable = await this.flaskService.convertToSeekableWebm(audio);
    return this.ociUploadService.uploadFileFromBuffer(
      seekable,
      `seekable-${audio.originalname}`,
    );
  }

  // answer가 start 가능한지 검사
  private checkCanStart(answer: Answer) {
    if (answer.status !== "ready") {
      throw new BadRequestException("answer가 ready 상태가 아닙니다.");
    }
  }

  // answer가 submit 가능한지 검사
  private checkCanSubmit(answer: Answer) {
    if (
      !["waiting", "answering", "ready", "submitted"].includes(answer.status)
    ) {
      throw new BadRequestException(
        "해당 answer 상태에서는 제출할 수 없습니다.",
      );
    }
  }

  // AnswerAnalysis를 pending 상태로 upsert
  private async upsertPendingAnalysis(
    manager: EntityManager,
    answer: Answer,
    faceData?: FaceFrameState[] | null,
  ): Promise<AnswerAnalysis> {
    const analysisRepo = manager.getRepository(AnswerAnalysis);

    let analysis = await analysisRepo.findOne({
      where: { answer: { id: answer.id } },
    });

    if (!analysis) {
      analysis = analysisRepo.create({
        answer,
        status: "pending",
        face_json: faceData ?? null,
      });
    } else {
      analysis.status = "pending";
      analysis.last_error = null;
      analysis.feedback_json = null;
      analysis.stt_json = null;
      analysis.refined_json = null;
      analysis.voice_json = null;
      analysis.face_json = faceData ?? null;
    }

    return analysisRepo.save(analysis);
  }

  // 답변 제출 트랜잭션 코어
  private async submitCore(
    manager: EntityManager,
    answer: Answer,
    params: {
      text: string;
      objectName?: string;
      faceData?: FaceFrameState[] | null;
    },
  ): Promise<SubmitAnswerResponseDto & { sessionId: string }> {
    const answerRepo = manager.getRepository(Answer);

    this.checkCanSubmit(answer);

    // 답변 제출 처리
    if (answer.status !== "submitted") {
      const endedAt = new Date();
      await answerRepo.update(answer.id, {
        status: "submitted",
        text: params.text,
        ended_at: endedAt,
        ...(params.objectName ? { audio_path: params.objectName } : {}),
      });
    }

    // AnswerAnalysis upsert
    const sessionId = answer.session_question.session.id;
    await this.upsertPendingAnalysis(manager, answer, params.faceData);

    // 다음 질문 조회
    const nextQuestion = await this.questionService.getNext(manager, sessionId);

    // 다음 질문이 있으면 ready로 변경
    // 없으면 세션 종료
    if (nextQuestion) {
      const nextAnswer = await answerRepo.findOne({
        where: { session_question: { id: nextQuestion.id } },
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
          answerId: nextAnswer ? nextAnswer.id : null,
        },
        finished: false,
        sessionId,
      };
    } else {
      await this.sessionService.finishSession(manager, sessionId);
      return { next: null, finished: true, sessionId };
    }
  }
}
