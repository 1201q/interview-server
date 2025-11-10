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

    return {
      session_id: session.id,
      job_role: session.role_guess ?? null,
      analyses: session.session_questions.map(AnalysisMapper.toAnalysisItem),
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
      analyses: [AnalysisMapper.toAnalysisItem(sq)],
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
