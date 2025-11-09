import { Injectable, NotFoundException } from "@nestjs/common";

import { isRubric } from "@/common/schemas/rubric.schema";

import { isFeedback } from "@/common/schemas/feedback.schema";
import { InjectRepository } from "@nestjs/typeorm";
import { Answer, InterviewSession } from "@/common/entities/entities";
import { Repository } from "typeorm";
import { TranscriptionSegment } from "openai/resources/audio/transcriptions";

import { isVoiceJson } from "@/common/schemas/voice.schema";
import {
  AnalysesListDto,
  AnalysesResultDto,
  AnalysesStatusesDto,
  AnalysesStatusesItem,
  FaceFrameState,
  FeedbackItemDto,
  RubricItemDto,
  SegmentDto,
  VoicePublic,
} from "@/common/types/analysis.types";

@Injectable()
export class AnalysisService {
  constructor(
    @InjectRepository(InterviewSession)
    private readonly sessionRepo: Repository<InterviewSession>,

    @InjectRepository(Answer)
    private readonly answerRepo: Repository<Answer>,
  ) {}

  private async findSessionWithAnalyses(sessionId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: [
        "session_questions",
        "session_questions.question",
        "session_questions.answers",
        "session_questions.answers.analysis",
      ],
      order: { session_questions: { order: "ASC" } },
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    return session;
  }

  async getAnalysesResult(sessionId: string): Promise<AnalysesResultDto> {
    const session = await this.findSessionWithAnalyses(sessionId);

    const analyses = session.session_questions.map((sq) =>
      this.formatAnalysisItem(sq),
    );

    return {
      session_id: session.id,
      job_role: session.role_guess ?? null,
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

    const face = analysis?.face_json
      ? (analysis.face_json as FaceFrameState[])
      : null;

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
      face: face,
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
    const session = await this.findSessionWithAnalyses(sessionId);

    const statuses: AnalysesStatusesItem[] = session.session_questions.map(
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
      session_id: session.id,
      session_status: session.status,
      job_role: session.role_guess ?? null,
      statuses: statuses,
    };
  }

  // 리스트

  async getAnalysesList(
    userId: string,
  ): Promise<{ results: AnalysesListDto[] }> {
    const result = await this.sessionRepo.find({
      where: { user_id: userId, status: "completed" },
      relations: [
        "session_questions.question",
        "session_questions.answers",
        "session_questions.answers.analysis",
      ],
      order: { session_questions: { order: "ASC" } },
    });

    if (!result) {
      throw new NotFoundException("Session not found");
    }

    return {
      results: result.map((session) => ({
        session_id: session.id,
        job_role: session.role_guess ?? null,
        interview_started_at:
          session.session_questions[0].answers[0].started_at,
        interview_completed_at:
          session.session_questions[session.session_questions.length - 1]
            .answers[
            session.session_questions[session.session_questions.length - 1]
              .answers.length - 1
          ].ended_at,
        rubric_status: session.rubric_gen_status,
        analysis_completed: session.session_questions.every(
          (sq) => sq.answers[0].analysis.progress === 100,
        ),
        questions: {
          text: session.session_questions
            .sort((a, b) => a.order - b.order)
            .map((sq) => sq.question.text),
        },
      })),
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
