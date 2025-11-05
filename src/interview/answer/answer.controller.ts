import {
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
  TestSubmitAnswerResponseDto,
} from "./answer.dto";

import { InterviewAnswerService } from "./answer.service";
import { FaceFrameState } from "@/common/types/analysis.types";

@ApiTags("인터뷰 답변")
@Controller("interview-answer")
export class InterviewAnswerController {
  constructor(private readonly answerService: InterviewAnswerService) {}

  @Post(":sessionId/:sQuestionId/start")
  @ApiOperation({ summary: "질문 응답 시작" })
  @ApiParam({ name: "sessionId", description: "세션 ID" })
  @ApiParam({ name: "sQuestionId", description: "세션 질문 ID" })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "응답이 시작되었습니다.",
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async start(
    @Param("sessionId") sessionId: string,
    @Param("sQuestionId") sQuestionId: string,
  ) {
    await this.answerService.startAnswer(sessionId, sQuestionId);
  }

  @Post(":sessionId/:sQuestionId/submit")
  @ApiOperation({
    summary: "응답 제출 및 다음 질문 준비 (꼬리질문 판별 x)",
  })
  @ApiParam({ name: "sessionId", description: "세션 ID" })
  @ApiParam({ name: "sQuestionId", description: "세션 질문 ID" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("audio"))
  @ApiBody({
    type: SubmitAnswerDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SubmitAnswerResponseDto,
  })
  async submit(
    @Param("sessionId") sessionId: string,
    @Param("sQuestionId") sQuestionId: string,
    @UploadedFile() file: Express.Multer.File | null,
    @Body() body: SubmitAnswerDto,
  ): Promise<SubmitAnswerResponseDto> {
    const nextQuestion = await this.answerService.submitAnswer({
      sessionId,
      sQuestionId,
      audio: file,
      text: body.answerText,
      decideFollowup: false,
    });

    return nextQuestion;
  }

  @Post(":answerId/start")
  @ApiOperation({ summary: "질문 응답 시작" })
  @ApiParam({ name: "answerId", description: "answer ID" })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "응답이 시작되었습니다.",
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async testStart(@Param("answerId") answerId: string) {
    console.log(`AnswerController: testStart ${answerId}`);
    await this.answerService.testStartAnswer(answerId);
  }

  @Post(":answerId/submit")
  @ApiOperation({
    summary: "응답 제출 및 다음 질문 준비 (꼬리질문 판별 x)",
  })
  @ApiParam({ name: "answerId", description: "answer ID" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("audio"))
  @ApiBody({
    type: SubmitAnswerDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: TestSubmitAnswerResponseDto,
  })
  async testSubmit(
    @Param("answerId") answerId: string,
    @UploadedFile() file: Express.Multer.File | null,
    @Body() body: SubmitAnswerDto,
  ): Promise<TestSubmitAnswerResponseDto> {
    const faceData: FaceFrameState[] | null = body.faceData
      ? (JSON.parse(body.faceData) as FaceFrameState[])
      : null;

    const nextQuestion = await this.answerService.testSubmitAnswer({
      answerId,
      audio: file,
      text: body.answerText,
      decideFollowup: false,
      faceData,
    });

    return nextQuestion;
  }
}
