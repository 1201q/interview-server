import {
  Body,
  Controller,
  NotFoundException,
  Patch,
  Post,
  Req,
  Res,
} from "@nestjs/common";

import { OciUploadService } from "src/oci-upload/oci-upload.service";
import { HttpService } from "@nestjs/axios";
import { InterviewService } from "./interview.service";
import { Request, Response } from "express";
import {
  CreateInterviewSessionArrayDto,
  InterviewSessionDto,
} from "./dtos/session.dto";
import { AuthService } from "src/auth/auth.service";
import { SessionService } from "./session.service";
import { text } from "stream/consumers";

@Controller("session")
export class SessionController {
  constructor(
    private readonly ociUploadService: OciUploadService,
    private readonly httpService: HttpService,
    private readonly sessionService: SessionService,
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
