import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { Between, LessThan, MoreThan, Repository } from "typeorm";

import NewInterviewSession from "../entities/new.interview.session.entity";
import { NewInterviewAnswer } from "../entities/new.interview.answer.entity";
import { LangChainService } from "src/shared/openai/langchain.service";

@Injectable()
export class AnswerService {
  constructor(
    @InjectRepository(NewInterviewSession)
    private interviewSessionRepo: Repository<NewInterviewSession>,

    @InjectRepository(NewInterviewAnswer)
    private interviewAnswerRepo: Repository<NewInterviewAnswer>,

    private readonly langchainService: LangChainService,
  ) {}

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
    answerText: string,
  ) {
    const currentQuestion = await this.interviewAnswerRepo.findOne({
      where: {
        session: { id: sessionId, user_id: userId },
        id: questionId,
      },
      relations: ["session", "session.request"],
    });

    if (!currentQuestion) {
      throw new NotFoundException("질문을 찾을 수 없습니다.");
    }

    currentQuestion.status = "submitted";
    currentQuestion.ended_at = new Date();
    currentQuestion.audio_path = audioPath;
    currentQuestion.analysis_status = "processing";
    currentQuestion.answer_text = answerText;

    await this.interviewAnswerRepo.save(currentQuestion);

    const nextQuestion = await this.getNextQuestion(
      currentQuestion.order,
      sessionId,
      userId,
    );

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

  private async handleFollowup(
    currentQuestion: NewInterviewAnswer,
    sessionId: string,
    userId: string,
  ) {
    const prevAnswers = await this.interviewAnswerRepo.find({
      where: {
        session: { id: sessionId, user_id: userId },
        order: LessThan(currentQuestion.order),
        status: "submitted",
      },
      order: { order: "ASC" },
      relations: ["question"],
    });

    const history = prevAnswers
      .map((item) => `Q. ${item.question.question}\nA. ${item.answer_text}`)
      .join("\n\n");

    const result = await this.langchainService.generateFollowup({
      original_question: currentQuestion.question.question,
      current_answer: currentQuestion.answer_text,
      qa_history: history,
      requestId: currentQuestion.session.request.vector_id,
    });

    if (result.result === "SKIP") return null;

    const existingFollowups = await this.interviewAnswerRepo.find({
      where: {
        session: { id: sessionId },
        order: Between(currentQuestion.order, currentQuestion.order + 1),
      },
      order: { order: "DESC" },
    });

    const lastOrder = existingFollowups.find(
      (q) => q.order > currentQuestion.order,
    )?.order;

    const nextOrder = lastOrder
      ? parseFloat((lastOrder + 0.1).toFixed(1))
      : parseFloat((currentQuestion.order + 0.1).toFixed(1));

    const followupQuestion = this.interviewAnswerRepo.create({
      session: currentQuestion.session,
      order: nextOrder,
      status: "ready",
    });

    return await this.interviewAnswerRepo.save(followupQuestion);
  }

  private async getNextQuestion(
    currentOrder: number,
    sessionId: string,
    userId: string,
  ) {
    return await this.interviewAnswerRepo.findOne({
      where: {
        session: { id: sessionId, user_id: userId },
        order: MoreThan(currentOrder),
      },
      order: { order: "ASC" },
    });
  }
}
