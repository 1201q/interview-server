import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { InterviewSession } from "./entities/interview.session.entity";
import { Repository } from "typeorm";
import { InterviewSessionQuestion } from "./entities/interview.session.question.entity";
import { Question } from "src/question/entities/question.entity";

@Injectable()
export class InterviewService {
  constructor(
    @InjectRepository(InterviewSession)
    private sessionRepository: Repository<InterviewSession>,

    @InjectRepository(InterviewSessionQuestion)
    private sessionQuestionRepository: Repository<InterviewSessionQuestion>,

    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
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

  async completeAnalysis(questionId: string, result: any) {
    await this.sessionQuestionRepository.update(questionId, {
      analysis_result: JSON.stringify(result),
      analysis_status: "completed",
    });
  }

  async markAnalysisFailed(questionId: string) {
    await this.sessionQuestionRepository.update(questionId, {
      analysis_status: "failed",
    });
  }

  async getAnalysisResult(questionId: string) {
    return this.sessionQuestionRepository.findOne({
      where: {
        id: questionId,
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
}
