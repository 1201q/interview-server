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

@Controller("interview/analysis")
export class AnalysisController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly ociUploadService: OciUploadService,
    private readonly flaskService: FlaskService,
  ) {}

  @Post("webhook")
  async handleWebhook(@Body() body: any) {
    const { question_id, result, error } = body;

    if (error) {
      await this.interviewService.markAnalysisFailed(question_id);

      return { status: "fail" };
    }

    await this.interviewService.completeAnalysis(question_id, result);
    return { status: "ok" };
  }
}
