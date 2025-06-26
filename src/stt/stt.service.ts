import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAI, toFile } from "openai";
import axios from "axios";

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

  async createRealtimeSession() {
    try {
      const response = await axios.post(
        "https://api.openai.com/v1/realtime/transcription_sessions",
        {
          input_audio_transcription: {
            model: "gpt-4o-transcribe",
            language: "ko",
          },
          input_audio_noise_reduction: {
            type: "near_field",
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.configService.get("OPENAI_API_KEY")}`,
            "Content-Type": "application/json",
          },
        },
      );
      //
      return response.data;
    } catch (error) {
      console.error(
        "[OpenAI] 세션 생성 실패:",
        error.response?.data || error.message,
      );
      throw new InternalServerErrorException("OpenAI 세션 발급 실패");
    }
  }
}
