import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { Readable } from "stream";

@Injectable()
export class WhisperService {
  private client: OpenAI;
  private readonly logger = new Logger(WhisperService.name);

  constructor(private config: ConfigService) {
    this.client = new OpenAI({ apiKey: config.get<string>("OPENAI_API_KEY") });
  }

  async transcribe(file: Express.Multer.File) {
    const stream = Readable.from(file.buffer);

    (stream as any).path = file.originalname;

    const res = await this.client.audio.transcriptions.create({
      model: "whisper-1",
      file: stream as any,
      response_format: "verbose_json",
      timestamp_granularities: ["word", "segment"],
      language: "ko",
    });

    return res;
  }
}
