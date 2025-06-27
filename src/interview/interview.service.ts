import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { Repository } from "typeorm";

import { NewInterviewAnswer } from "./entities/new.interview.answer.entity";
import { NewInterviewSession } from "./entities/new.interview.session.entity";

@Injectable()
export class InterviewService {
  constructor(
    @InjectRepository(NewInterviewSession)
    private sessionRepository: Repository<NewInterviewSession>,

    @InjectRepository(NewInterviewAnswer)
    private sessionQuestionRepository: Repository<NewInterviewAnswer>,

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
