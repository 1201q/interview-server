import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { InterviewService } from "./interview.service";
import { AuthService } from "src/auth/auth.service";

import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import {
  CreateInterviewSessionArrayDto,
  InterviewSessionDto,
  InterviewSessionWithOrderDto,
} from "./dtos/session.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { OciUploadService } from "src/oci-upload/oci-upload.service";

@Controller("interview")
export class InterviewController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly ociUploadService: OciUploadService,
  ) {}

  @Post("create_session")
  async createInterviewSession(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: CreateInterviewSessionArrayDto,
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

  @Get("session/:session_id")
  async getActiveSession(
    @Req() req: Request,
    @Param("session_id") session_id: string,
  ) {
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    const session = await this.interviewService.getActiveSessionBySessionId(
      userId,
      session_id,
    );

    if (!session) {
      throw new NotFoundException(
        "인터뷰 세션이 존재하지 않거나 접근 권한이 없습니다.",
      );
    }

    return session;
  }

  @Patch("session/ready")
  async readySession(@Req() req: Request, @Body() body: InterviewSessionDto) {
    const { session_id } = body;
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    const session = await this.interviewService.getActiveSessionBySessionId(
      userId,
      session_id,
    );

    if (!session) {
      throw new NotFoundException(
        "인터뷰 세션이 존재하지 않거나 접근 권한이 없습니다.",
      );
    }

    await this.interviewService.readySession(userId, session_id);

    return { message: "세션이 ready 상태로 변경되었습니다." };
  }

  @Patch("session/start")
  async startSession(@Req() req: Request, @Body() body: InterviewSessionDto) {
    const { session_id } = body;
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    const session = await this.interviewService.getActiveSessionBySessionId(
      userId,
      session_id,
    );

    if (!session) {
      throw new NotFoundException(
        "인터뷰 세션이 존재하지 않거나 접근 권한이 없습니다.",
      );
    }

    await this.interviewService.startInterviewSession(userId, session_id);

    return {
      message:
        "세션이 in_progress 상태로 변경되었습니다. 첫번째 질문을 ready로 변경합니다.",
    };
  }

  @Patch("session/complete")
  async completeSession(
    @Req() req: Request,
    @Body() body: InterviewSessionDto,
  ) {
    const { session_id } = body;
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    const session = await this.interviewService.getActiveSessionBySessionId(
      userId,
      session_id,
    );

    if (!session) {
      throw new NotFoundException(
        "인터뷰 세션이 존재하지 않거나 접근 권한이 없습니다.",
      );
    }

    await this.interviewService.completeInterviewSession(userId, session_id);

    return {
      message: "세션이 completed 상태로 변경되었습니다.",
    };
  }

  @Patch("session/question/submit")
  @UseInterceptors(FileInterceptor("audio"))
  async submitAnswer(
    @Req() req: Request,
    @UploadedFile() audio: Express.Multer.File,
    @Body() body: InterviewSessionWithOrderDto,
  ) {
    const { session_id, order } = body;
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    const session = await this.interviewService.getActiveSessionBySessionId(
      userId,
      session_id,
    );

    if (!session) {
      throw new NotFoundException(
        "인터뷰 세션이 존재하지 않거나 접근 권한이 없습니다.",
      );
    }

    const audioPath = await this.ociUploadService.uploadFile(audio);

    const success = await this.interviewService.submitAnswer(
      userId,
      session_id,
      order,
      audioPath,
    );

    if (success.isLastQuestion) {
      return {
        isLast: true,
      };
    } else {
      return {
        isLast: false,
      };
    }
  }

  @Patch("session/question/start")
  async startAnswer(
    @Req() req: Request,
    @Body() body: InterviewSessionWithOrderDto,
  ) {
    const { session_id, order } = body;
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    const session = await this.interviewService.getActiveSessionBySessionId(
      userId,
      session_id,
    );

    if (!session) {
      throw new NotFoundException(
        "인터뷰 세션이 존재하지 않거나 접근 권한이 없습니다.",
      );
    }

    await this.interviewService.startAnswer(userId, session_id, order);

    return {
      message: `${order + 1}번째 질문을 시작합니다.`,
    };
  }
}
