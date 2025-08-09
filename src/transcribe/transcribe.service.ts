import { Injectable, InternalServerErrorException } from "@nestjs/common";

import axios from "axios";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TranscribeService {
  constructor(private readonly config: ConfigService) {}

  async createRealtimeSession() {
    try {
      const response = await axios.post(
        "https://api.openai.com/v1/realtime/sessions",
        {
          model: "gpt-4o-realtime-preview-2024-12-17", //  WebRTC용 리얼타임 모델
          modalities: ["text"],
          input_audio_transcription: {
            model: "gpt-4o-transcribe",
            language: "ko",
          },
          input_audio_noise_reduction: { type: "near_field" },
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.get("OPENAI_API_KEY")}`,
            "Content-Type": "application/json",
          },
        },
      );

      return response.data;
    } catch (error) {
      throw new InternalServerErrorException("OpenAI 세션 발급 실패");
    }
  }
}
