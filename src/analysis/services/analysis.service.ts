import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import {
  BuildEvaluationPrompt,
  BuildSegmentsFeedbackPrompt,
} from "src/common/prompts/analyze.prompt";
import {
  EvalRequestDto,
  GenerateRubricDto,
  RubricDto,
  STTRefineDto,
  STTRefineSegmentsDto,
} from "../analysis.dto";
import { evalJsonSchema } from "src/common/schemas/eval.schema";
import { computeScores } from "src/common/utils/scoring";

import {
  BuildRefineSegmentsPrompt,
  BuildSttRefinePromptV3,
} from "src/common/prompts/stt-refine-prompt";

import { Repository } from "typeorm";
import { InterviewSession } from "src/common/entities/entities";
import { InjectRepository } from "@nestjs/typeorm";
import {
  RefinedItemZ,
  RefinedSegmentItemZ,
} from "src/common/schemas/prompt.schema";
import { zodTextFormat } from "openai/helpers/zod";
import { FeedbackSegSchema } from "@/common/schemas/stt-feedback.schema";
import {
  BuildRubricUserPrompt,
  BuildRubricUserPromptV2,
  BuildRubricUserPromptV3,
} from "@/common/prompts/rubric.prompt";

import { OpenAIService } from "@/openai/openai.service";
import { RubricResponseSchema } from "@/common/schemas/rubric.schema";

@Injectable()
export class AnalysisService {
  private openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly ai: OpenAIService,

    @InjectRepository(InterviewSession)
    private readonly sessionRepo: Repository<InterviewSession>,
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

  async feedbackSegments(dto: {
    questionText: string;
    jobRole: string;
    segments: string[];
  }) {
    const format = zodTextFormat(FeedbackSegSchema, "feedback_segments");

    const segWithId = dto.segments.map((seg, i) => ({
      seg_id: `s${i}`,
      text: seg,
    }));

    const res = await this.openai.responses.parse({
      model: "gpt-5",
      input: [
        {
          role: "system",
          content:
            "당신은 한 기업의 면접관입니다. 면접관으로서 답변에 대한 피드백을 제공하세요.",
        },
        {
          role: "user",
          content: BuildSegmentsFeedbackPrompt({ ...dto, segments: segWithId }),
        },
      ],
      reasoning: { effort: "low" },
      text: { format },
    });

    return res.output_parsed;
  }

  async transcript(file: Express.Multer.File) {
    const text = await this.ai.transcribe(file);
    return text;
  }

  async refineSttWords(dto: STTRefineDto) {
    const schema = RefinedItemZ(dto.words.length);
    const format = zodTextFormat(schema, "refined_words");

    const baseInput = [
      { role: "user" as const, content: BuildSttRefinePromptV3(dto) },
    ];

    const run = async (input = baseInput) =>
      this.openai.responses.parse({
        model: "gpt-5-mini-2025-08-07",
        input,
        reasoning: { effort: "low" },
        text: { format, verbosity: "low" },
      });

    try {
      const res = await run();

      const result = res.output_parsed.refined_words;
      const refinedWithId = result.map((w, idx) => ({
        id: `w${idx}`,
        word: w,
      }));

      return refinedWithId;
    } catch (error) {
      const safePrompt = `입력과 동일한 길이의 배열을 {"refined_words":[...]}만 출력하세요. 설명/코드블록 금지. ${JSON.stringify(dto.words.map((w) => w.word))}`;

      console.error("Refine failed, retrying with safe prompt...", error);
      try {
        const res2 = await run([{ role: "user", content: safePrompt }]);
        const result2 = res2.output_parsed.refined_words;
        const refinedWithId = result2.map((w, idx) => ({
          id: `w${idx}`,
          word: w,
        }));
        return refinedWithId;
      } catch (error2) {
        console.error("Retry also failed. Returning original words.", error2);
        return dto.words.map((w, idx) => ({
          word: w.word,
          id: `w${idx}`,
        }));
      }
    }
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

  async getAnalysis(sessionId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: [
        "session_questions.question",
        "session_questions.answers.analyses",
      ],
    });

    const result = session.session_questions.map((sq) => {
      return {
        text: sq.question.text,
        section: sq.question.section,
        id: sq.id,
        order: sq.order,
        result: {
          feedback: sq.answers[0].analyses[0].feedback_json,
          stt: sq.answers[0].analyses[0].stt_json,
          voice: sq.answers[0].analyses[0].voice_json,
          refined: sq.answers[0].analyses[0].refined_words_json,
        },
      };
    });

    return result;

    console.log(session);
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
