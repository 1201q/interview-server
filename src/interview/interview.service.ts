import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { InterviewSession } from "./entities/interview.session.entity";
import { Repository } from "typeorm";
import { InterviewSessionQuestion } from "./entities/interview.session.question.entity";

import { NewInterviewAnswer } from "./entities/new.interview.answer.entity";

@Injectable()
export class InterviewService {
  constructor(
    @InjectRepository(InterviewSession)
    private sessionRepository: Repository<InterviewSession>,

    @InjectRepository(InterviewSessionQuestion)
    private sessionQuestionRepository: Repository<InterviewSessionQuestion>,

    @InjectRepository(NewInterviewAnswer)
    private interviewAnswerRepo: Repository<NewInterviewAnswer>,
  ) {}

  async getActiveSessionBySessionId(userId: string, sessionId: string) {
    return this.sessionRepository.findOne({
      where: {
        user_id: userId,
        id: sessionId,
      },
      relations: ["questions", "questions.question"],
      order: {
        questions: {
          order: "ASC",
        },
      },
    });
  }

  async getAudioPath(questionId: string) {
    const question = await this.sessionQuestionRepository.findOne({
      where: { id: questionId },
      select: ["id", "audio_path"],
    });

    return question?.audio_path;
  }

  async getQuestionsBySessionId(sessionId: string) {
    return this.sessionQuestionRepository.find({
      where: {
        session: { id: sessionId },
      },
    });
  }

  async newGetQuestionsBySessionId(sessionId: string) {
    return this.interviewAnswerRepo.find({
      where: {
        session: { id: sessionId },
      },
    });
  }
}
