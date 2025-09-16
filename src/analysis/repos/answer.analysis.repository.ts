import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import { InjectDataSource } from "@nestjs/typeorm";
import { Answer, AnswerAnalysis } from "src/common/entities/entities";

@Injectable()
export class AnswerAnalysisRepository {
  private repo: Repository<AnswerAnalysis>;
  private answerRepo: Repository<Answer>;

  constructor(@InjectDataSource() private ds: DataSource) {
    this.repo = ds.getRepository(AnswerAnalysis);
    this.answerRepo = ds.getRepository(Answer);
  }

  async ensureOne(answerId: string) {
    const answer = await this.answerRepo.findOneOrFail({
      where: { id: answerId },
    });
    let aa = await this.repo.findOne({ where: { answer: { id: answerId } } });
    if (!aa) {
      aa = this.repo.create({ answer, status: "processing" });
      aa = await this.repo.save(aa);
    } else if (aa.status === "pending") {
      aa.status = "processing";
      aa = await this.repo.save(aa);
    }
    return aa;
  }

  async upsertJson(id: string, patch: Partial<AnswerAnalysis>) {
    await this.repo
      .createQueryBuilder()
      .update()
      .set({
        ...patch,
        status: () =>
          `CASE WHEN status='pending' THEN 'processing' ELSE status END`,
      })
      .where("id = :id", { id })
      .execute();
  }

  async setFailed(id: string, err: unknown) {
    await this.repo
      .createQueryBuilder()
      .update()
      .set({ status: "failed", last_error: String(err ?? "") })
      .where("id = :id", { id })
      .execute();
  }
}
