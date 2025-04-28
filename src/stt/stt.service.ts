import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAI, toFile } from "openai";

@Injectable()
export class SttService {
  private openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get("OPENAI_API_KEY"),
    });
  }

  async transcribe(file: Express.Multer.File): Promise<string> {
    const fakeFile = await toFile(file.buffer, file.originalname);

    const transcription = await this.openai.audio.transcriptions.create({
      file: fakeFile,
      model: "whisper-1",
      response_format: "text",
    });

    return transcription;
  }
}
