import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { BuildEvaluationPrompt } from "src/common/prompts/analyze.prompt";
import { EvalRequestDto } from "./analyze.dto";
import { evalJsonSchema } from "src/common/schemas/eval.schema";
import { computeScores } from "src/common/utils/scoring";

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
      const res = await this.openai.responses.parse({
        model: "gpt-5",
        input: [
          {
            role: "system",
            content:
              "당신은 한 기업의 면접관입니다. 면접관으로서 답변에 대한 평가와 피드백을 제공하세요.",
          },
          { role: "user", content: BuildEvaluationPrompt(dto) },
        ],
        reasoning: { effort: "low" },
        text: { format: evalJsonSchema },
      });

      const result = res.output_parsed;

      const calc = computeScores(result.metrics, {
        ValueChain_missing: result.flags.ValueChain_missing ?? false,
        Evidence_missing: result.flags.Evidence_missing ?? false,
        Scenario_missing: result.flags.Scenario_missing ?? false,
        Concept_error: result.flags.Concept_error ?? false,
        Offtopic: result.flags.Offtopic ?? false,
      });

      console.log(result, calc);

      return { ...result, ...calc };
    } catch (error) {}
  }
}
