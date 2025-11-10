import { AnswerAnalysis } from "@/common/entities/entities";
import { Injectable } from "@nestjs/common/decorators";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

@Injectable()
export class AnalysisRepository {
  constructor(
    @InjectRepository(AnswerAnalysis)
    private readonly repo: Repository<AnswerAnalysis>,
  ) {}

  //
  async findWithAnswer(answerId: string) {
    return this.repo.findOne({
      where: { answer: { id: answerId } },
      relations: [
        "answer",
        "answer.session_question",
        "answer.session_question.question",
      ],
    });
  }

  async updateSttResult(answerId: string, sttJson: any) {
    await this.repo
      .createQueryBuilder()
      .update(AnswerAnalysis)
      .set({ stt_json: sttJson })
      .where("answer_id = :answerId", { answerId })
      .execute();
  }

  async updateRefinedResult(answerId: string, refined: any[]) {
    await this.repo
      .createQueryBuilder()
      .update(AnswerAnalysis)
      .set({ refined_json: refined })
      .where("answer_id = :answerId", { answerId })
      .execute();
  }

  async updateVoiceResult(answerId: string, voiceJson: any) {
    await this.repo
      .createQueryBuilder()
      .update(AnswerAnalysis)
      .set({ voice_json: voiceJson })
      .where("answer_id = :answerId", { answerId })
      .execute();
  }

  async updateFeedbackResult(answerId: string, feedbackJson: any) {
    await this.repo
      .createQueryBuilder()
      .update(AnswerAnalysis)
      .set({ feedback_json: feedbackJson })
      .where("answer_id = :answerId", { answerId })
      .execute();
  }

  async updateProgressAndStatus(answerId: string, progress: number) {
    await this.repo
      .createQueryBuilder()
      .update(AnswerAnalysis)
      .set({
        progress,
        status: progress === 100 ? "completed" : "processing",
      })
      .where("answer_id = :answerId", { answerId })
      .execute();
  }

  async markFailed(answerId: string, reason: string | null) {
    await this.repo
      .createQueryBuilder()
      .update(AnswerAnalysis)
      .set({
        status: "failed",
        last_error: reason,
      })
      .where("answer_id = :answerId", { answerId })
      .execute();
  }
}
