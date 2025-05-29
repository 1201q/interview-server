import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  Sse,
} from "@nestjs/common";
import { InterviewService } from "./interview.service";
import { AuthService } from "src/auth/auth.service";

import { Request } from "express";
import { SseService } from "./sse.service";
import { map, Observable } from "rxjs";

@Controller("interview/session")
export class InterviewController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly authService: AuthService,
    private readonly sseService: SseService,
  ) {}

  @Get(":session_id")
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

  @Sse("stream/:session_id")
  stream(
    @Param("session_id") sessionId: string,
  ): Observable<{ data: any; type: string }> {
    return this.sseService.getInterviewSeesionStatusStream(sessionId).pipe(
      map((data) => ({
        type: "status",
        data,
      })),
    );
  }
}
