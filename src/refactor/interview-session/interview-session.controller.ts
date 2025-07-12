import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";

import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { InterviewSessionService } from "./interview-session.service";
import { GenerateResponseDto } from "../generate-request/generate-request.dto";
import {
  CreateInterviewSessionDto,
  InterviewSessionDetailDto,
} from "./interview-session.dto";

@ApiTags("인터뷰 세션")
@Controller("interview-session")
export class InterviewSessionController {
  constructor(private readonly sessionService: InterviewSessionService) {}

  @Get(":sessionId")
  @ApiOperation({ summary: "세션 상세 조회" })
  @ApiParam({ name: "sessionId", description: "Session ID" })
  @ApiResponse({ status: HttpStatus.OK, type: InterviewSessionDetailDto })
  getDetail(@Param("sessionId") id: string) {
    return this.sessionService.getSessionDetail(id);
  }

  @Post("create")
  @ApiOperation({ summary: "새 면접 세션 생성" })
  @ApiResponse({ status: HttpStatus.CREATED, type: GenerateResponseDto })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateInterviewSessionDto) {
    return this.sessionService.createSession(dto);
  }

  @Post("start/:sessionId")
  @ApiOperation({ summary: "면접 세션 시작" })
  @ApiParam({ name: "sessionId", description: "Session ID" })
  @ApiResponse({ status: HttpStatus.OK, type: GenerateResponseDto })
  startSession(@Param("sessionId") sessionId: string) {
    return this.sessionService.startSession(sessionId);
  }
}
