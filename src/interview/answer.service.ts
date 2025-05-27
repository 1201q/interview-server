import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { InterviewSession } from "./entities/interview.session.entity";
import { Repository } from "typeorm";
import { InterviewSessionQuestion } from "./entities/interview.session.question.entity";
import { Question } from "src/question/entities/question.entity";

@Injectable()
export class AnswerService {
  constructor(
    @InjectRepository(InterviewSession)
    private sessionRepository: Repository<InterviewSession>,

    @InjectRepository(InterviewSessionQuestion)
    private sessionQuestionRepository: Repository<InterviewSessionQuestion>,

    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
  ) {}

  async startAnswer(userId: string, sessionId: string, questionId: string) {
    const question = await this.sessionQuestionRepository.findOne({
      where: {
        session: { id: sessionId, user_id: userId },
        id: questionId,
      },
      relations: ["session"],
    });

    if (!question) {
      throw new NotFoundException("질문이 존재하지 않거나 권한이 없습니다.");
    }

    if (question.status !== "ready") {
      throw new Error("해당 질문은 아직 시작할 수 없습니다.");
    }

    question.status = "answering";
    question.started_at = new Date();
    await this.sessionQuestionRepository.save(question);
  }

  async submitAnswer(
    userId: string,
    sessionId: string,
    questionId: string,
    audioPath: string,
  ) {
    const currentQuestion = await this.sessionQuestionRepository.findOne({
      where: {
        session: { id: sessionId, user_id: userId },
        id: questionId,
      },
      relations: ["session"],
    });

    if (!currentQuestion)
      throw new NotFoundException("질문을 찾을 수 없습니다.");

    currentQuestion.status = "submitted";
    currentQuestion.ended_at = new Date();
    currentQuestion.audio_path = audioPath;
    currentQuestion.analysis_status = "processing";

    await this.sessionQuestionRepository.save(currentQuestion);

    const nextQuestion = await this.sessionQuestionRepository.findOne({
      where: {
        session: { id: sessionId, user_id: userId },
        order: currentQuestion.order + 1,
      },
    });

    if (!nextQuestion) {
      await this.sessionRepository.update(
        { id: sessionId },
        { status: "completed" },
      );

      return { isLastQuestion: true, questionId: currentQuestion.id };
    }

    nextQuestion.status = "ready";
    await this.sessionQuestionRepository.save(nextQuestion);

    return {
      isLastQuestion: false,
      questionId: currentQuestion.id,
      nextQuestion: {
        id: nextQuestion.id,
        order: nextQuestion.order,
        text: nextQuestion.question.question_text,
      },
    };
  }
}
