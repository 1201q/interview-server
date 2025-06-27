import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

import { GeneratedQuestionFromResumeResult } from "src/common/interfaces/common.interface";
import { QuestionGeneratorPrompt } from "./prompts/question-generator.prompt";

@Injectable()
export class OpenaiService {
  private openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get("OPENAI_API_KEY"),
    });
  }

  async questionGenerator(resume: string, recruitment: string) {
    const prompt_text = QuestionGeneratorPrompt(resume, recruitment);

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "당신은 어떤 직군이든 면접 질문을 만들어낼 수 있는 전문 면접관입니다.",
        },
        { role: "user", content: prompt_text },
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;

    try {
      const parsed: { questions: GeneratedQuestionFromResumeResult[] } =
        JSON.parse(content ?? "");

      return parsed;
    } catch (error) {
      console.log(error);
      throw new Error();
    }
  }
}
