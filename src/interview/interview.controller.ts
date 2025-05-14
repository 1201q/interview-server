import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { InterviewService } from "./interview.service";
import { AuthService } from "src/auth/auth.service";
import { InterviewSession } from "./entities/interview.session.entity";
import { Request } from "express";

@Controller("interview")
export class InterviewController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly authService: AuthService,
  ) {}

  @Post("create_session")
  async createInterviewSession(
    @Req() req: Request,
    @Body() body: { questions: { id: string; order: number }[] },
  ): Promise<InterviewSession> {
    const { questions } = body;

    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    return this.interviewService.createInterviewSession(userId, questions);
  }
}
