import { Injectable, InternalServerErrorException } from "@nestjs/common";

import axios from "axios";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import {
  RefineTextPrompt,
  RefineTextPromptV2,
} from "src/common/prompts/refine.prompt";
import { SttBiasPrompt } from "src/common/prompts/stt-bias-prompt";
import { RefineResponseDto } from "./transcribe.dto";

@Injectable()
export class TranscribeService {
  private openai: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.get("OPENAI_API_KEY"),
    });
  }

  async createRealtimeSession() {
    try {
      const response = await axios.post(
        "https://api.openai.com/v1/realtime/sessions",
        {
          model: "gpt-4o-realtime-preview-2024-12-17", //  WebRTC용 리얼타임 모델
          modalities: ["text"],
          instructions: "Transcribe only. Never answer.",
          input_audio_transcription: {
            model: "gpt-4o-transcribe",
            language: "ko",
          },
          input_audio_noise_reduction: { type: "near_field" },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 200,
            silence_duration_ms: 250,
            create_response: false,
          },
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
      throw new InternalServerErrorException(
        `${error.message}: OpenAI 세션 발급 실패`,
      );
    }
  }

  async testcreateRealtimeSession(context: string) {
    try {
      const prompt = context;

      const response = await axios.post(
        "https://api.openai.com/v1/realtime/sessions",
        {
          model: "gpt-4o-realtime-preview-2024-12-17", //  WebRTC용 리얼타임 모델
          modalities: ["text"],
          instructions: "Transcribe only. Never answer.",
          input_audio_transcription: {
            model: "gpt-4o-transcribe",
            language: "ko",
            prompt,
          },
          input_audio_noise_reduction: { type: "near_field" },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 200,
            silence_duration_ms: 250,
            create_response: false,
          },
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
      console.log(error);
      throw new InternalServerErrorException(
        `${error.message}: OpenAI 세션 발급 실패`,
      );
    }
  }

  async refineTranscript(
    context: string,
    transcript: string,
  ): Promise<RefineResponseDto> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content:
              "당신은 한국어 STT 보정기다. 오탈자/전문용어/구두점만 최소 수정하고, 어투/의미/어순/단어 수는 유지한다.",
          },
          { role: "user", content: RefineTextPromptV2(context, transcript) },
        ],
        reasoning_effort: "minimal",
        presence_penalty: 0,
        frequency_penalty: 0,
        response_format: { type: "text" },
      });

      const result = response.choices[0].message.content;

      return {
        text: result,
        status: "completed",
      };
    } catch (error) {
      console.error(error);

      return {
        status: "failed",
      };
    }
  }
}
