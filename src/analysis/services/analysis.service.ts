import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { BuildEvaluationPrompt } from "src/common/prompts/analyze.prompt";
import { EvalRequestDto, STTRefineDto } from "../analysis.dto";
import { evalJsonSchema } from "src/common/schemas/eval.schema";
import { computeScores } from "src/common/utils/scoring";
import { Readable } from "stream";
import { BuildSttRefinePrompt } from "src/common/prompts/stt-refine-prompt";
import z from "zod";
import { DataSource } from "typeorm";

@Injectable()
export class AnalysisService {
  private openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
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

  async transcript(file: Express.Multer.File) {
    const stream = Readable.from(file.buffer);

    (stream as any).path = file.originalname;

    const res = await this.openai.audio.transcriptions.create({
      model: "whisper-1",
      file: stream as any,
      response_format: "verbose_json",
      timestamp_granularities: ["word", "segment"],
      language: "ko",
    });

    console.log(res);

    return res;
  }

  async refineSttWords(dto: STTRefineDto) {
    console.log(BuildSttRefinePrompt(dto));

    try {
      const res = await this.openai.responses.create({
        model: "gpt-5-mini-2025-08-07",
        input: [{ role: "user", content: BuildSttRefinePrompt(dto) }],
        reasoning: { effort: "low" },
      });

      const Z = z.array(z.string()).length(dto.words.length);

      try {
        const corrected = Z.parse(JSON.parse(res.output_text));

        return corrected as string[];
      } catch (error) {}
    } catch (error) {}
  }
}
