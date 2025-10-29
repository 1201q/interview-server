import { ApiTags } from "@nestjs/swagger";

import { Request } from "express";
import { AuthService } from "@/auth/auth.service";

import {
  Controller,
  Sse,
  Param,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { AnalysisEventsService } from "./analysis.events.service";
import { interval, map, merge, Observable } from "rxjs";

@ApiTags("분석 sse")
@Controller("analysis/sse")
export class AnalysisSseController {
  constructor(
    private readonly events: AnalysisEventsService,
    private readonly authService: AuthService,
  ) {}

  @Sse(":sessionId")
  sse(@Param("sessionId") sessionId: string, @Req() req: Request) {
    const token = req.cookies.accessToken as string;

    // if (!token) throw new UnauthorizedException();

    const bus$ = this.events.stream(sessionId);

    const hb$ = interval(15_000).pipe(
      map(() => ({
        data: JSON.stringify({
          type: ":heartbeat",
          session_id: sessionId,
          ts: Date.now(),
        }),
      })),
    );

    return merge(bus$, hb$);
  }
}
