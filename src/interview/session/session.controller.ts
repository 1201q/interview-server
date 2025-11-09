import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from "@nestjs/common";

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiCookieAuth,
} from "@nestjs/swagger";
import { InterviewSessionService } from "./session.service";

import {
  CreateInterviewSessionBodyDto,
  SessionResponseDto,
  SessionDetailDto,
  SessionRubricDto,
} from "./session.dto";

import { Request } from "express";
import { AuthService } from "src/auth/auth.service";

@ApiTags("인터뷰 세션")
@Controller("interview-session")
export class InterviewSessionController {
  constructor(
    private readonly sessionService: InterviewSessionService,
    private readonly authService: AuthService,
  ) {}

  @Get(":sessionId")
  @ApiOperation({ summary: "세션 상세 조회" })
  @ApiParam({ name: "sessionId", description: "Session ID" })
  @ApiResponse({ status: HttpStatus.OK, type: SessionDetailDto })
  getDetail(@Param("sessionId") sessionId: string) {
    return this.sessionService.getSessionDetail(sessionId);
  }

  @Get(":sessionId/rubric")
  @ApiOperation({ summary: "세션 rubric 조회" })
  @ApiParam({ name: "sessionId", description: "Session ID" })
  @ApiResponse({ status: HttpStatus.OK, type: SessionRubricDto })
  getSessionRubric(@Param("sessionId") sessionId: string) {
    return this.sessionService.getSessionRubric(sessionId);
  }

  @Post("create")
  @ApiOperation({ summary: "새 면접 세션 생성" })
  @ApiResponse({ status: HttpStatus.CREATED, type: SessionResponseDto })
  @ApiCookieAuth("accessToken")
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: CreateInterviewSessionBodyDto,
    @Req() req: Request,
  ) {
    const token = req.cookies.accessToken as string;
    const { id } = await this.authService.decodeAccessToken(token);

    return this.sessionService.createSession({
      ...body,
      user_id: id,
    });
  }

  @Post(":sessionId/start")
  @ApiOperation({ summary: "면접 세션 시작" })
  @ApiParam({ name: "sessionId", description: "Session ID" })
  @ApiResponse({ status: HttpStatus.OK, type: SessionResponseDto })
  startSession(@Param("sessionId") sessionId: string) {
    return this.sessionService.startSession(sessionId);
  }

  @Post(":sessionId/reset")
  @ApiOperation({
    summary: "해당 면접 세션 정보를 초기화",
  })
  @ApiParam({ name: "sessionId", description: "Session ID" })
  @ApiResponse({ status: HttpStatus.OK, type: SessionResponseDto })
  async reset(@Param("sessionId") sessionId: string) {
    return this.sessionService.resetSession(sessionId);
  }
}
