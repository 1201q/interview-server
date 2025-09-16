import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

@Injectable()
export class GateService {
  constructor(@InjectDataSource() private ds: DataSource) {}

  async tryComplete(analysisId: string) {
    await this.ds.query(
      `
      UPDATE answer_analyses
        SET status = 'completed'
      WHERE id = :1
        AND status <> 'completed'
        AND stt_json IS NOT NULL
        AND refined_words_json IS NOT NULL
        AND feedback_json IS NOT NULL
        AND voice_json IS NOT NULL
      `,
      [analysisId],
    );
  }
}
