import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import {
  EvaluationAnswerPrompt,
  EvaluationAnswerPromptV2,
  EvaluationAnswerPromptV2_2,
  EvaluationNarrativeOnlyPrompt,
} from "src/common/prompts/analyze.prompt";
import { EvalRequestDto } from "./analyze.dto";
import {
  evalFormat,
  EvalSchema,
  evalV2Format,
} from "src/common/schemas/eval.schema";

@Injectable()
export class AnalyzeService {
  private openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get("OPENAI_API_KEY"),
    });
  }

  async evaluateAnswer(dto: EvalRequestDto) {
    try {
      const response = await this.openai.responses.parse({
        model: "gpt-5",
        input: [
          {
            role: "system",
            content: "당신은 한 기업의 면접관입니다.",
          },
          { role: "user", content: EvaluationNarrativeOnlyPrompt(dto) },
        ],
        reasoning: { effort: "minimal" },

        // text: { format: evalV2Format },
      });

      const parsed = JSON.parse(response.output_text);

      console.log(parsed);

      return parsed;
    } catch (error) {}
  }

  async streamEvaluateAnswer(dto: EvalRequestDto) {
    try {
      const stream = this.openai.responses
        .stream({
          model: "gpt-5",
          input: [
            {
              role: "system",
              content: "당신은 한 기업의 면접관입니다.",
            },
            { role: "user", content: EvaluationAnswerPrompt(dto) },
          ],
          text: { format: evalFormat },
        })
        .on("response.refusal.delta", (event) => {
          console.log(event.delta);
          process.stdout.write(event.delta);
        })
        .on("response.output_text.delta", (event) => {
          console.log(event.delta);
          process.stdout.write(event.delta);
        })
        .on("response.output_text.done", () => {
          console.log("\n");
          process.stdout.write("\n");
        });

      const result = await stream.finalResponse();

      console.log(result);
    } catch (error) {}
  }
}
