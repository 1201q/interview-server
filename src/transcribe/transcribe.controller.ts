import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { AuthService } from "src/auth/auth.service";
import { TranscribeService } from "./transcribe.service";
import { RefineBodyDto } from "./transcribe.dto";

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

  @Post("/refine")
  @ApiOperation({ summary: "텍스트 보정" })
  async refineTranscript(@Body() body: RefineBodyDto) {
    const { transcript, question, context } = body;

    if (!transcript.trim()) {
      throw new BadRequestException("transcript는 필수입니다.");
    }

    let promptContext = "";

    if (question) {
      promptContext +=
        "이 텍스트는 면접 중 필사되었고, 다음 질문에 답변하였습니다. ";
      promptContext += `질문: ${transcript}`;
    }

    if (context) {
      promptContext += "이 텍스트는 해당 상황에서 필사되었습니다. ";
      promptContext += `상황: ${context}`;
    }

    const result = await this.transcribeService.refineTranscript(
      promptContext,
      transcript,
    );

    return { final_text: result };
  }
}
