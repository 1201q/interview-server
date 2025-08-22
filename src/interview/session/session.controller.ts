import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";

import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { InterviewSessionService } from "./session.service";

import {
  CreateInterviewSessionDto,
  InterviewSessionDetailDto,
  GenerateResponseDto,
  InterviewJobRoleDto,
  KeywordsForSttDto,
} from "./session.dto";

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

  @Post(":sessionId/start")
  @ApiOperation({ summary: "면접 세션 시작" })
  @ApiParam({ name: "sessionId", description: "Session ID" })
  @ApiResponse({ status: HttpStatus.OK, type: GenerateResponseDto })
  startSession(@Param("sessionId") sessionId: string) {
    return this.sessionService.startSession(sessionId);
  }

  @Post(":sessionId/role")
  @ApiOperation({
    summary: "해당 면접 세션의 직군을 생성",
  })
  @ApiParam({ name: "sessionId", description: "Session ID" })
  @ApiResponse({ status: HttpStatus.OK, type: InterviewJobRoleDto })
  async getJobRoleFromSessionId(@Param("sessionId") sessionId: string) {
    return this.sessionService.getJobRoleFromSessionId(sessionId);
  }

  @Post("role")
  @ApiOperation({
    summary: "해당 면접 세션의 직군을 생성",
  })
  @ApiResponse({ status: HttpStatus.OK, type: InterviewJobRoleDto })
  async getJobRoleFromJobText(@Query("jobText") jobText: string) {
    return this.sessionService.getJobRoleFromJobText(jobText);
  }

  @Post(":sessionId/keywords")
  @ApiOperation({
    summary: "해당 면접 세션의 STT 프롬프트에 사용할 키워드를 생성",
  })
  @ApiParam({ name: "sessionId", description: "Session ID" })
  @ApiResponse({ status: HttpStatus.OK, type: KeywordsForSttDto })
  getKeywordsForStt(@Param("sessionId") sessionId: string) {
    return this.sessionService.getKeywordsForStt(sessionId);
  }
}
