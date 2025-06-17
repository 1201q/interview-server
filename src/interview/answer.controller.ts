import {
  Body,
  Controller,
  Patch,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";

import { OciUploadService } from "src/oci-upload/oci-upload.service";

import { Request } from "express";
import { InterviewSessionWithQuestionIdDto } from "./dtos/session.dto";
import { AuthService } from "src/auth/auth.service";

import { FileInterceptor } from "@nestjs/platform-express";
import { FlaskService } from "src/flask/flask.service";
import { AnswerService } from "./answer.service";
import { AnalysisService } from "./analysis.service";

@Controller("answer")
export class AnswerController {
  constructor(
    private readonly ociUploadService: OciUploadService,
    private readonly authService: AuthService,
    private readonly flaskService: FlaskService,
    private readonly answerService: AnswerService,
    private readonly analysisService: AnalysisService,
  ) {}

  @Patch("submit")
  @UseInterceptors(FileInterceptor("audio"))
  async newsubmitAnswer(
    @Req() req: Request,
    @UploadedFile() audio: Express.Multer.File,
    @Body() body: InterviewSessionWithQuestionIdDto,
  ) {
    const { session_id, question_id } = body;
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    const convertedBuffer =
      await this.flaskService.convertToSeekableWebm(audio);

    const objectName = await this.ociUploadService.uploadFileFromBuffer(
      convertedBuffer,
      `seekable-${audio.originalname}`,
    );

    const result = await this.answerService.submitAnswer(
      userId,
      session_id,
      question_id,
      objectName,
    );

    // const jobRole = await this.analysisService.getJobRole(session_id);

    // await this.flaskService.sendToAnalysisServer(
    //   audio,
    //   result.questionId,
    //   result.questionText,
    //   jobRole,
    // );

    if (result.isLastQuestion) {
      return { message: `마지막 질문입니다.`, is_last: true };
    }

    return {
      message: `계속 진행합니다. 다음 질문은 ${result.nextQuestion.id}`,
      is_last: false,
      question: {
        question_id: result.nextQuestion.id,
        question_text: result.nextQuestion.text,
        section: result.nextQuestion.section,
      },
      current_order: result.nextQuestion.order,
    };
  }

  @Patch("start")
  async newstartAnswer(
    @Req() req: Request,
    @Body() body: InterviewSessionWithQuestionIdDto,
  ) {
    const { session_id, question_id } = body;
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    await this.answerService.startAnswer(userId, session_id, question_id);

    return {
      message: `${question_id} 질문을 시작합니다.`,
    };
  }
}
