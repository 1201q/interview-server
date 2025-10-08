import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  GenerateRubricDto,
  RubricDto,
  STTRefineSegmentsDto,
} from "./analysis.dto";

import { BuildRefineSegmentsPrompt } from "src/common/prompts/stt-refine-prompt";

import { RefinedSegmentItemZ } from "src/common/schemas/prompt.schema";

import {
  BuildRubricUserPromptV2,
  BuildRubricUserPromptV3,
} from "@/common/prompts/rubric.prompt";

import { OpenAIService } from "@/llm/openai.service";
import { RubricResponseSchema } from "@/common/schemas/rubric.schema";

@Injectable()
export class AnalysisService {
  constructor(
    private readonly configService: ConfigService,
    private readonly ai: OpenAIService,
  ) {}

  async transcript(file: Express.Multer.File) {
    const text = await this.ai.transcribe(file);
    return text;
  }

  async refineSttSegments(dto: STTRefineSegmentsDto) {
    const schema = RefinedSegmentItemZ(dto.segments.length);
    const baseInput = [
      { role: "user" as const, content: BuildRefineSegmentsPrompt(dto) },
    ];

    const parsed = await this.ai.chatParsed({
      opts: { input: baseInput, reasoning: { effort: "low" } },
      schema: schema,
    });

    console.log(parsed);
    return parsed.refined_segments;
  }

  async rubric(dto: RubricDto) {
    const run = await this.ai.chatParsed({
      opts: {
        model: "gpt-5-mini",
        input: [
          { role: "system", content: "당신은 한 기업의 면접관입니다." },
          { role: "user", content: BuildRubricUserPromptV2(dto) },
        ],
        reasoning: { effort: "medium", summary: "detailed" },
        tools: this.ai.withFileSearch(dto.vectorId, { max_num_results: 8 }),
        text: { verbosity: "medium" },
      },
      schema: RubricResponseSchema,
    });

    return run;
  }

  async generateRubric(dto: GenerateRubricDto) {
    const run = await this.ai.chatParsed({
      opts: {
        model: "gpt-5-mini",
        input: [
          { role: "system", content: "당신은 한 기업의 면접관입니다." },
          { role: "user", content: BuildRubricUserPromptV3(dto) },
        ],
        reasoning: { effort: "medium", summary: "detailed" },
        tools: this.ai.withFileSearch(dto.vectorId, { max_num_results: 8 }),
        text: { verbosity: "medium" },
      },
      schema: RubricResponseSchema,
    });

    return run;
  }
}
