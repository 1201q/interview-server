import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
} from "./interview-answer.dto";

@ApiTags("interview-answer")
@Controller("interview-answer/:sessionId")
export class InterviewAnswerController {
  constructor() {}

  @Post(":questionId/start")
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
    // return this.sessionService.createSession(dto);

    console.log(sessionId, questionId);
    return null;
  }

  @Post(":questionId/submit")
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
    // return this.sessionService.createSession(dto);

    console.log(sessionId, questionId);
    return null;
  }

  @Get("next")
  @ApiOperation({ summary: "다음 응답할 질문 조회" })
  @ApiParam({ name: "sessionId", description: "세션 ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SubmitAnswerResponseDto,
    description: "다음 질문 정보 또는 세션 완료 여부 반환",
  })
  async getNext(
    @Param("sessionId") sessionId: string,
  ): Promise<SubmitAnswerResponseDto> {
    return null;
  }
}
