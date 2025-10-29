import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  FeedbackDto,
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
import { isRubric, RubricResponseSchema } from "@/common/schemas/rubric.schema";
import { RoleGuessPrompt } from "@/common/prompts/role-guess.prompt";
import {
  BuildFeedbackDeveloperPrompt,
  BuildFeedbackUserPrompt,
} from "@/common/prompts/feedback.prompt";
import { FeedbackSchema, isFeedback } from "@/common/schemas/feedback.schema";
import { InjectRepository } from "@nestjs/typeorm";
import { Answer, InterviewSession } from "@/common/entities/entities";
import { Repository } from "typeorm";
import { TranscriptionSegment } from "openai/resources/audio/transcriptions";
import { OciDBService } from "@/external-server/oci-db.service";
import { isVoiceJson } from "@/common/schemas/voice.schema";
import {
  AnalysesResultDto,
  AnalysesStatusesDto,
  AnalysesStatusesItem,
  FeedbackItemDto,
  RubricItemDto,
  SegmentDto,
  VoicePublic,
} from "@/common/types/analysis.types";

@Injectable()
export class AnalysisService {
  constructor(
    private readonly configService: ConfigService,
    private readonly ai: OpenAIService,
    private readonly oci: OciDBService,

    @InjectRepository(InterviewSession)
    private readonly sessionRepo: Repository<InterviewSession>,

    @InjectRepository(Answer)
    private readonly answerRepo: Repository<Answer>,
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

  async getAnalysesResult(sessionId: string): Promise<AnalysesResultDto> {
    const result = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: [
        "session_questions",
        "session_questions.question",
        "session_questions.answers",
        "session_questions.answers.analysis",
      ],
      order: { session_questions: { order: "ASC" } },
    });

    if (!result) {
      throw new NotFoundException("Session not found");
    }

    const analyses = result.session_questions.map((sq) =>
      this.formatAnalysisItem(sq),
    );

    return {
      session_id: result.id,
      job_role: result.role_guess ?? null,
      analyses,
    };
  }

  async getAnalysisResult(
    sessionId: string,
    answerId: string,
  ): Promise<AnalysesResultDto> {
    const result = await this.sessionRepo.findOne({
      where: {
        id: sessionId,
        session_questions: { answers: { id: answerId } },
      },
      relations: [
        "session_questions",
        "session_questions.question",
        "session_questions.answers",
        "session_questions.answers.analysis",
      ],
    });

    if (!result) {
      throw new NotFoundException("Session or answer not found");
    }

    const sq = result.session_questions[0];

    return {
      session_id: result.id,
      job_role: result.role_guess ?? null,
      analyses: [this.formatAnalysisItem(sq)],
    };
  }

  private formatAnalysisItem(sq: any) {
    const answer = sq.answers?.[0] ?? null;
    const analysis = answer?.analysis ?? null;

    const sttSegments =
      analysis?.stt_json && "segments" in analysis.stt_json
        ? (analysis.stt_json.segments as TranscriptionSegment[])
        : [];

    const refined = Array.isArray(analysis?.refined_json)
      ? (analysis!.refined_json as any[])
      : [];

    const segments: SegmentDto[] = sttSegments.map((s, i) => ({
      id: s.id,
      start: s.start,
      end: s.end,
      text: s.text,
      refined_text: refined[i],
    }));

    const feedback = this.toFeedbackDto(analysis?.feedback_json);
    const voicePublic = this.toPublicVoice(
      isVoiceJson(analysis?.voice_json) ? analysis!.voice_json : null,
    );
    const rubricDto = this.toRubricDto(sq.rubric_json);

    return {
      id: sq.id,
      order: sq.order,
      question_text: sq.question.text,
      rubric: {
        intent: rubricDto.intent,
        required: rubricDto.required,
        optional: rubricDto.optional,
        context: rubricDto.context,
      },
      answer: {
        audio_path: answer?.audio_path ?? null,
        segments,
      },
      feedback,
      voice: voicePublic,
    };
  }

  async getObjectName(answerId: string) {
    const target = await this.answerRepo.findOne({
      where: { id: answerId },
      select: { audio_path: true },
    });

    return target.audio_path;
  }

  async getStatuses(sessionId: string): Promise<AnalysesStatusesDto> {
    const result = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: [
        "session_questions",
        "session_questions.question",
        "session_questions.answers",
        "session_questions.answers.analysis",
      ],
      order: { session_questions: { order: "ASC" } },
    });

    if (!result) {
      throw new NotFoundException("Session not found");
    }

    const statuses: AnalysesStatusesItem[] = result.session_questions.map(
      (sq) => ({
        answer_id: sq.answers[0].id,
        order: sq.order,
        question_text: sq.question.text,
        answer_status: sq.answers[0].status,
        rubric_status: sq.rubric_status,
        analysis_status: sq.answers[0].analysis.status,
        analysis_progress: {
          overall: sq.answers[0].analysis.progress,
          stt: sq.answers[0].analysis.stt_json ? true : false,
          refine: sq.answers[0].analysis.refined_json ? true : false,
          audio: sq.answers[0].analysis.voice_json ? true : false,
          feedback: sq.answers[0].analysis.feedback_json ? true : false,
        },
      }),
    );

    return {
      session_id: result.id,
      session_status: result.status,
      job_role: result.role_guess ?? null,
      statuses: statuses,
    };
  }

  toPublicVoice(v: any | null | undefined): VoicePublic | null {
    if (!v) return null;

    return {
      duration_ms: v.duration_ms,
      speech_ms: v.speech_ms,
      silence_ms: v.silence_ms,
      filler_ms: v.filler_ms,
      ratios: v.ratios,
      fluency: v.fluency,
      pause_hygiene: v.pause_hygiene,
    };
  }

  toRubricDto(x: unknown): RubricItemDto {
    if (!isRubric(x)) {
      return { intent: null, required: null, optional: null, context: null };
    }
    return {
      intent: x.intent,
      required: x.required,
      optional: x.optional,
      context: x.context,
    };
  }

  toFeedbackDto(x: unknown): FeedbackItemDto {
    if (!isFeedback(x)) {
      return { one_line: "", feedback: "", misconception: null };
    }

    return {
      one_line: x.one_line,
      feedback: x.feedback,
      misconception: x.misconception
        ? {
            summary: x.misconception.summary,
            explanation: x.misconception.explanation,
            evidence: x.misconception.evidence,
          }
        : null,
    };
  }
}
