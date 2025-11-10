import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Answer, InterviewSession } from "@/common/entities/entities";
import { Repository } from "typeorm";

import {
  AnalysesListDto,
  AnalysesResultDto,
  AnalysesStatusesDto,
} from "@/common/types/analysis.types";
import { AnalysisMapper } from "./analysis.mapper";

@Injectable()
export class AnalysisService {
  constructor(
    @InjectRepository(InterviewSession)
    private readonly sessionRepo: Repository<InterviewSession>,

    @InjectRepository(Answer)
    private readonly answerRepo: Repository<Answer>,
  ) {}

  private async findSessionWithAnalyses(sessionId: string, userId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, user_id: userId },
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
      analyses: session.session_questions.map(AnalysisMapper.toAnalysisItem),
    };
  }

  async getAnalysisResult(
    sessionId: string,
    answerId: string,
    userId: string,
  ): Promise<AnalysesResultDto> {
    const result = await this.sessionRepo.findOne({
      where: {
        id: sessionId,
        user_id: userId,
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
      where: {
        id: answerId,
        session_question: { session: { user_id: userId } },
      },
      select: { audio_path: true },
      relations: { session_question: { session: true } },
    });

    if (!target) {
      throw new NotFoundException("해당 답변의 오디오를 찾을 수 없습니다.");
    }

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
      statuses: session.session_questions.map((sq) =>
        AnalysisMapper.toStatusesItem(sq),
      ),
    };
  }

  // 리스트
  async getAnalysesList(
    userId: string,
  ): Promise<{ results: AnalysesListDto[] }> {
    const sessions = await this.sessionRepo.find({
      where: { user_id: userId, status: "completed" },
      relations: [
        "session_questions.question",
        "session_questions.answers",
        "session_questions.answers.analysis",
      ],
      order: { session_questions: { order: "ASC" } },
    });

    if (!sessions) {
      throw new NotFoundException("Session not found");
    }

    return {
      results: sessions.map(AnalysisMapper.toListItem),
    };
  }
}
