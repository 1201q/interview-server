import { Body, Controller, Post, Req } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { AuthService } from "src/auth/auth.service";
import { TranscribeService } from "./transcribe.service";
import { CreateRealtimeTokenDto } from "./transcribe.dto";
import { SttBiasPrompt } from "src/common/prompts/stt-bias-prompt";

@ApiTags("음성 필사")
@Controller("transcribe")
export class TranscribeController {
  constructor(
    private readonly authService: AuthService,
    private readonly transcribeService: TranscribeService,
  ) {}

  //
  @Post("/realtime/token")
  @ApiCookieAuth("accessToken")
  @ApiOperation({ summary: "gpt-4o-transcribe 토큰 발급" })
  async createRealtimeToken(@Req() req: Request) {
    const token = req.cookies.accessToken as string;
    await this.authService.decodeAccessToken(token);

    const session = await this.transcribeService.createRealtimeSession();

    console.log(session);

    return session;
  }

  //
  @Post("/realtime/token/test")
  @ApiCookieAuth("accessToken")
  @ApiOperation({ summary: "gpt-4o-transcribe 토큰 발급 (테스트)" })
  async testcreateRealtimeToken(
    @Req() req: Request,
    @Body() dto: CreateRealtimeTokenDto,
  ) {
    const { jobRole, questionText, keywords } = dto;

    const token = req.cookies.accessToken as string;
    await this.authService.decodeAccessToken(token);

    const context = SttBiasPrompt({
      keywords: keywords,
      questionText: questionText,
      jobRole: jobRole,
    });

    const session =
      await this.transcribeService.testcreateRealtimeSession(context);

    return session;
  }
}
