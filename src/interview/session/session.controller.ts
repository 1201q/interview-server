import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
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
import { JwtAuthGuard } from "@/auth/guard/jwt-auh.guard";

@ApiTags("인터뷰 세션")
@Controller("interview-session")
export class InterviewSessionController {
  constructor(
    private readonly sessionService: InterviewSessionService,
    private readonly authService: AuthService,
  ) {}

  @Get(":sessionId")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("accessToken")
  @ApiOperation({ summary: "세션 상세 조회" })
  @ApiParam({ name: "sessionId", description: "Session ID" })
  @ApiResponse({ status: HttpStatus.OK, type: SessionDetailDto })
  getDetail(@Param("sessionId") sessionId: string, @Req() req: Request) {
    const userId = req.user["id"];
    return this.sessionService.getSessionDetail(sessionId, userId);
  }

  @Get(":sessionId/rubric")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("accessToken")
  @ApiOperation({ summary: "세션 rubric 조회" })
  @ApiParam({ name: "sessionId", description: "Session ID" })
  @ApiResponse({ status: HttpStatus.OK, type: SessionRubricDto })
  getSessionRubric(@Param("sessionId") sessionId: string, @Req() req: Request) {
    const userId = req.user["id"];
    return this.sessionService.getSessionRubric(sessionId, userId);
  }

  @Post("create")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("accessToken")
  @ApiOperation({ summary: "새 면접 세션 생성" })
  @ApiResponse({ status: HttpStatus.CREATED, type: SessionResponseDto })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: CreateInterviewSessionBodyDto,
    @Req() req: Request,
  ) {
    const userId = req.user["id"];

    return this.sessionService.createSession({
      ...body,
      user_id: userId,
    });
  }

  @Post(":sessionId/start")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("accessToken")
  @ApiOperation({ summary: "면접 세션 시작" })
  @ApiParam({ name: "sessionId", description: "Session ID" })
  @ApiResponse({ status: HttpStatus.OK, type: SessionResponseDto })
  startSession(@Param("sessionId") sessionId: string, @Req() req: Request) {
    const userId = req.user["id"];
    return this.sessionService.startSession(sessionId, userId);
  }

  @Post(":sessionId/reset")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("accessToken")
  @ApiOperation({
    summary: "해당 면접 세션 정보를 초기화",
  })
  @ApiParam({ name: "sessionId", description: "Session ID" })
  @ApiResponse({ status: HttpStatus.OK, type: SessionResponseDto })
  async reset(@Param("sessionId") sessionId: string, @Req() req: Request) {
    const userId = req.user["id"];
    return this.sessionService.resetSession(sessionId, userId);
  }
}
