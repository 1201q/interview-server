import { InterviewSession, SessionQuestion } from "@/common/entities/entities";
import { isFeedback } from "@/common/schemas/feedback.schema";
import { isRubric } from "@/common/schemas/rubric.schema";
import { isVoiceJson } from "@/common/schemas/voice.schema";
import {
  AnalysesListDto,
  AnalysesStatusesItem,
  FaceFrameState,
  FeedbackItemDto,
  RubricItemDto,
  SegmentDto,
  VoicePublic,
} from "@/common/types/analysis.types";
import { TranscriptionSegment } from "openai/resources/audio/transcriptions";

export class AnalysisMapper {
  static toPublicVoice(v: any | null | undefined): VoicePublic | null {
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

  static toRubricDto(x: unknown): RubricItemDto {
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

  static toFeedbackDto(x: unknown): FeedbackItemDto {
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

  static toAnalysisItem(sq: any) {
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

  static toStatusesItem(sq: SessionQuestion): AnalysesStatusesItem {
    return {
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
    };
  }

  static toListItem(session: InterviewSession): AnalysesListDto {
    return {
      session_id: session.id,
      job_role: session.role_guess ?? null,
      interview_started_at: session.session_questions[0].answers[0].started_at,
      interview_completed_at:
        session.session_questions[session.session_questions.length - 1].answers[
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
    };
  }
}
