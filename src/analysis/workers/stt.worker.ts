import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";

import { DataSource } from "typeorm";
import { Answer, AnswerAnalysis } from "@/common/entities/entities";
import { OciDBService } from "@/external-server/oci-db.service";
import axios from "axios";
import { OpenAIService } from "@/openai/openai.service";

type MulterLike = Pick<
  Express.Multer.File,
  "buffer" | "originalname" | "mimetype"
>;

@Injectable()
@Processor("stt", { concurrency: 3 })
export class SttWorker extends WorkerHost {
  private readonly logger = new Logger(SttWorker.name);

  constructor(
    private readonly ds: DataSource,
    private readonly ociService: OciDBService,
    private readonly oaiService: OpenAIService,
    @InjectQueue("refine") private readonly refineQ: Queue,
  ) {
    super();
  }

  async process(job: Job<{ answerId: string }>) {
    const { answerId } = job.data;

    const answer = await this.ds.getRepository(Answer).findOne({
      where: { id: answerId },
      relations: ["session_question"],
    });

    if (!answer || !answer.audio_path) {
      this.logger.error(
        `Answer not found or missing audio_path for ID: ${answerId}`,
      );
      return;
    }

    // 1. url 발급
    const url = await this.ociService.generatePresignedUrl(answer.audio_path);
    this.logger.debug(`audio url: ${url}`);

    // 2. 스트림 다운로드
    const stream = await this.downloadStream(url, answer.audio_path);

    // 3. STT API 호출
    const result = await this.oaiService.transcribe(stream as any);
    this.logger.debug(`STT result: ${result.text}`);

    // 4. db에 processing 상태로 저장
    await this.ds.getRepository(AnswerAnalysis).save({
      answer: { id: answerId },
      stt_json: result as any,
    });
    this.logger.debug(`save STT_json: ${answerId}`);

    // 5. queue에 refine 작업 추가
    await this.refineQ.add(
      "refine",
      { answerId },
      {
        jobId: `refine:${answerId}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
      },
    );
  }

  private async downloadStream(url: string, filename: string) {
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
    });

    const file: MulterLike = {
      buffer: Buffer.from(res.data),
      originalname: filename,
      mimetype: res.headers["content-type"] || "audio/webm",
    };

    return file;
  }
}
