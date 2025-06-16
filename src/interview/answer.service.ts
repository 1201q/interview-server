import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { Repository } from "typeorm";

import { NewInterviewSession } from "./entities/new.interview.session.entity";
import { NewInterviewAnswer } from "./entities/new.interview.answer.entity";

@Injectable()
export class AnswerService {
  constructor(
    @InjectRepository(NewInterviewSession)
    private interviewSessionRepo: Repository<NewInterviewSession>,

    @InjectRepository(NewInterviewAnswer)
    private interviewAnswerRepo: Repository<NewInterviewAnswer>,
  ) {}

  // async startAnswer(userId: string, sessionId: string, questionId: string) {
  //   const question = await this.sessionQuestionRepository.findOne({
  //     where: {
  //       session: { id: sessionId, user_id: userId },
  //       id: questionId,
  //     },
  //     relations: ["session"],
  //   });

  //   if (!question) {
  //     throw new NotFoundException("질문이 존재하지 않거나 권한이 없습니다.");
  //   }

  //   if (question.status !== "ready") {
  //     throw new Error("해당 질문은 아직 시작할 수 없습니다.");
  //   }

  //   question.status = "answering";
  //   question.started_at = new Date();
  //   await this.sessionQuestionRepository.save(question);
  // }

  // async submitAnswer(
  //   userId: string,
  //   sessionId: string,
  //   questionId: string,
  //   audioPath: string,
  // ) {
  //   const currentQuestion = await this.sessionQuestionRepository.findOne({
  //     where: {
  //       session: { id: sessionId, user_id: userId },
  //       id: questionId,
  //     },
  //     relations: ["session"],
  //   });

  //   if (!currentQuestion)
  //     throw new NotFoundException("질문을 찾을 수 없습니다.");

  //   currentQuestion.status = "submitted";
  //   currentQuestion.ended_at = new Date();
  //   currentQuestion.audio_path = audioPath;
  //   currentQuestion.analysis_status = "processing";

  //   await this.sessionQuestionRepository.save(currentQuestion);

  //   const nextQuestion = await this.sessionQuestionRepository.findOne({
  //     where: {
  //       session: { id: sessionId, user_id: userId },
  //       order: currentQuestion.order + 1,
  //     },
  //   });

  //   if (!nextQuestion) {
  //     await this.sessionRepository.update(
  //       { id: sessionId },
  //       { status: "completed" },
  //     );

  //     return {
  //       isLastQuestion: true,
  //       questionId: currentQuestion.id,
  //       questionText: currentQuestion.question.question_text,
  //     };
  //   }

  //   nextQuestion.status = "ready";
  //   await this.sessionQuestionRepository.save(nextQuestion);

  //   return {
  //     isLastQuestion: false,
  //     questionId: currentQuestion.id,
  //     questionText: currentQuestion.question.question_text,
  //     nextQuestion: {
  //       id: nextQuestion.id,
  //       order: nextQuestion.order,
  //       text: nextQuestion.question.question_text,
  //     },
  //   };
  // }

  async startAnswer(userId: string, sessionId: string, questionId: string) {
    const question = await this.interviewAnswerRepo.findOne({
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
    await this.interviewAnswerRepo.save(question);
  }

  async submitAnswer(
    userId: string,
    sessionId: string,
    questionId: string,
    audioPath: string,
  ) {
    const currentQuestion = await this.interviewAnswerRepo.findOne({
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

    await this.interviewAnswerRepo.save(currentQuestion);

    const nextQuestion = await this.interviewAnswerRepo.findOne({
      where: {
        session: { id: sessionId, user_id: userId },
        order: currentQuestion.order + 1,
      },
    });

    if (!nextQuestion) {
      await this.interviewSessionRepo.update(
        { id: sessionId },
        { status: "completed" },
      );

      return {
        isLastQuestion: true,
        questionId: currentQuestion.id,
        questionText: currentQuestion.question.question,
      };
    }

    nextQuestion.status = "ready";
    await this.interviewAnswerRepo.save(nextQuestion);

    return {
      isLastQuestion: false,
      questionId: currentQuestion.id,
      questionText: currentQuestion.question.question,
      nextQuestion: {
        id: nextQuestion.id,
        order: nextQuestion.order,
        text: nextQuestion.question.question,
        section: nextQuestion.question.section,
      },
    };
  }
}
