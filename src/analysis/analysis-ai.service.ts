import { OpenAIService } from "@/openai-service/openai.service";
import { Injectable } from "@nestjs/common";
import {
  FeedbackDto,
  GenerateRubricDto,
  STTRefineSegmentsDto,
} from "./analysis.dto";
import { RefinedSegmentItemZ } from "@/common/schemas/prompt.schema";
import { BuildRefineSegmentsPrompt } from "@/common/prompts/stt-refine-prompt";
import { BuildRubricUserPromptV3 } from "@/common/prompts/rubric.prompt";
import { RubricResponseSchema } from "@/common/schemas/rubric.schema";
import { RoleGuessPrompt } from "@/common/prompts/role-guess.prompt";
import {
  BuildFeedbackDeveloperPrompt,
  BuildFeedbackUserPrompt,
} from "@/common/prompts/feedback.prompt";
import { FeedbackSchema } from "@/common/schemas/feedback.schema";

@Injectable()
export class AnalysisAiService {
  constructor(private readonly ai: OpenAIService) {}

  async transcript(file: Express.Multer.File) {
    return this.ai.transcribe(file);
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

    return parsed.refined_segments;
  }

  async generateRubric(dto: GenerateRubricDto) {
    return this.ai.chatParsed({
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
  }

  async guessRole(jobText: string): Promise<string> {
    const run = await this.ai.chat({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: "당신은 한 기업의 면접관입니다." },
        { role: "user", content: RoleGuessPrompt(jobText) },
      ],
      text: { verbosity: "low" },
    });

    return run.result;
  }

  async feedback(dto: FeedbackDto) {
    const run = await this.ai.chatParsed({
      opts: {
        model: "gpt-5",
        input: [
          { role: "developer", content: BuildFeedbackDeveloperPrompt() },
          { role: "user", content: BuildFeedbackUserPrompt(dto) },
        ],
        reasoning: { effort: "medium", summary: "detailed" },
        tools: this.ai.withFileSearch(dto.vectorId, { max_num_results: 4 }),
        text: { verbosity: "low" },
      },
      schema: FeedbackSchema,
    });

    return run;
  }
}
