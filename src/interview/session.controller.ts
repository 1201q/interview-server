import { Body, Controller, Patch, Post, Req } from "@nestjs/common";
import { Request } from "express";
import {
  CreateInterviewSessionArrayDto,
  InterviewSessionDto,
} from "./dtos/session.dto";
import { AuthService } from "src/auth/auth.service";
import { SessionService } from "./session.service";
import { InterviewService } from "./interview.service";
import { AnalysisService } from "./analysis.service";

@Controller("session")
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly analysisService: AnalysisService,
    private readonly interviewService: InterviewService,
    private readonly authService: AuthService,
  ) {}

  @Post("create")
  async createInterviewSession(
    @Req() req: Request,
    @Body() body: CreateInterviewSessionArrayDto,
  ) {
    const { questions } = body;

    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    const sessionId = await this.sessionService.createInterviewSession(
      userId,
      questions,
    );

    const createdQuestions =
      await this.interviewService.getQuestionsBySessionId(sessionId);

    const submitData = createdQuestions.map((q) => {
      return {
        question_text: q.question.question_text,
        question_id: q.question.id,
      };
    });

    const evaluationStandard =
      await this.analysisService.generateEvaluations(submitData);

    await this.analysisService.updateEvaluationStandard(
      sessionId,
      evaluationStandard,
    );

    return { session_id: sessionId };
  }

  @Patch("start")
  async startInterviewSession(
    @Req() req: Request,
    @Body() body: InterviewSessionDto,
  ) {
    const { session_id } = body;
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    const { question, totalCount } =
      await this.sessionService.startInterviewSession(userId, session_id);

    return {
      message:
        "세션이 in_progress 상태로 변경되었습니다. 첫번째 질문을 ready로 변경합니다.",
      question: {
        question_id: question.id,
        question_text: question.text,
      },
      current_order: question.order,
      total_questions: totalCount,
    };
  }

  @Patch("complete")
  async completeInterviewSession(
    @Req() req: Request,
    @Body() body: InterviewSessionDto,
  ) {
    const { session_id } = body;
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    const session = await this.sessionService.completeInterviewSession(
      userId,
      session_id,
    );

    return {
      message: "세션이 completed 상태로 변경되었습니다.",
    };
  }
}
