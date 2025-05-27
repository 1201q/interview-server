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
import { FlaskService } from "src/flask/flask.service";

@Controller("interview")
export class InterviewController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly authService: AuthService,
  ) {}

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
}
