import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express/multer";

import {
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from "@nestjs/swagger";
import {
  SubmitAnswerDto,
  SubmitAnswerResponseDto,
  UploadAudioDto,
} from "./answer.dto";

import { InterviewAnswerService } from "./answer.service";

@ApiTags("인터뷰 답변")
@Controller("interview-answer")
export class InterviewAnswerController {
  constructor(private readonly answerService: InterviewAnswerService) {}

  @Post(":sessionId/:questionId/start")
  @ApiOperation({ summary: "질문 응답 시작" })
  @ApiParam({ name: "sessionId", description: "세션 ID" })
  @ApiParam({ name: "questionId", description: "세션 질문 ID" })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "응답이 시작되었습니다.",
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async start(
    @Param("sessionId") sessionId: string,
    @Param("questionId") questionId: string,
  ) {
    await this.answerService.startAnswer(sessionId, questionId);
  }

  @Post(":sessionId/:questionId/submit")
  @ApiOperation({ summary: "응답 제출 및 다음 질문 준비" })
  @ApiParam({ name: "sessionId", description: "세션 ID" })
  @ApiParam({ name: "questionId", description: "세션 질문 ID" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("audio"))
  @ApiBody({ type: SubmitAnswerDto })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SubmitAnswerResponseDto,
  })
  async submit(
    @Param("sessionId") sessionId: string,
    @Param("questionId") questionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: SubmitAnswerDto,
  ): Promise<SubmitAnswerResponseDto> {
    if (!file) {
      throw new BadRequestException("audio 파일이 필요합니다.");
    }

    const nextQuestion = await this.answerService.submitAnswer(
      sessionId,
      questionId,
      file,
      body.answerText,
    );
    return nextQuestion;
  }

  @Post(":sessionId/:questionId/submit/test")
  @ApiOperation({
    summary: "응답 제출 및 다음 질문 준비 (테스트 - 꼬리질문 판별 x)",
  })
  @ApiParam({ name: "sessionId", description: "세션 ID" })
  @ApiParam({ name: "questionId", description: "세션 질문 ID" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("audio"))
  @ApiBody({
    type: SubmitAnswerDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SubmitAnswerResponseDto,
  })
  async testSubmit(
    @Param("sessionId") sessionId: string,
    @Param("questionId") questionId: string,
    @UploadedFile() file: Express.Multer.File | null,
    @Body() body: SubmitAnswerDto,
  ): Promise<SubmitAnswerResponseDto> {
    const nextQuestion = await this.answerService.testSubmitAnswer(
      sessionId,
      questionId,
      file ?? null,
      body.answerText,
    );
    return nextQuestion;
  }

  @Post("/upload/test")
  @ApiOperation({
    summary: "음성 업로드 테스트",
  })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("audio"))
  @ApiBody({ type: UploadAudioDto })
  @ApiResponse({
    status: HttpStatus.OK,
  })
  async testUpload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadAudioDto,
  ) {
    if (!file) {
      throw new BadRequestException("audio 파일이 필요합니다.");
    }

    const res = await this.answerService.testUpload(file);

    return res;
  }
}
