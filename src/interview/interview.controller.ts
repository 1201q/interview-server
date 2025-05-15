import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { InterviewService } from "./interview.service";
import { AuthService } from "src/auth/auth.service";
import { InterviewSession } from "./entities/interview.session.entity";
import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";

@Controller("interview")
export class InterviewController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post("create_session")
  async createInterviewSession(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { questions: { id: string; order: number }[] },
  ) {
    const { questions } = body;

    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    const session = await this.interviewService.createInterviewSession(
      userId,
      questions,
    );

    return res.status(200).json({ session });
  }

  @Get("session/status")
  async getActiveSession(@Req() req: Request, @Res() res: Response) {
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    const session =
      await this.interviewService.getActiveSessionByUserId(userId);

    console.log(session.status);

    return session.status;
  }
}
