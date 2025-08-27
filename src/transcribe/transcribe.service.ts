import { Injectable, InternalServerErrorException } from "@nestjs/common";

import axios from "axios";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { RefineTextPrompt } from "src/common/prompts/refine.prompt";
import { SttBiasPrompt } from "src/common/prompts/stt-bias-prompt";

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

  async testcreateRealtimeSession(args: {
    keywords: string[];
    jobRole?: string;
    questionText?: string;
  }) {
    try {
      const prompt = SttBiasPrompt({
        keywords: args.keywords,
        questionText: args.questionText,
        jobRole: args.jobRole,
      });

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

  async refineTranscript(context: string, transcript: string) {
    const response = await this.openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "system",
          content: "당신은 한국어 필사본을 보정하는 도우미입니다.",
        },
        { role: "user", content: RefineTextPrompt(context, transcript) },
      ],
      reasoning_effort: "low",
      response_format: { type: "text" },
    });

    console.log(response.choices[0].message.content);

    return response.choices[0].message.content;
  }
}
