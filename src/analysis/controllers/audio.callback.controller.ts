import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { AnswerAnalysisRepository } from "../repos/answer.analysis.repository";
import { GateService } from "../services/gate.service";

@ApiTags("오디오 분석 콜백")
@Controller("analyze/audio")
export class AudioCallbackController {
  constructor(
    private readonly aaRepo: AnswerAnalysisRepository,
    private readonly gate: GateService,
  ) {}

  @Post("/callback")
  async onAudioDone(@Body() payload: { analysisId: string; voiceJson: any }) {
    await this.aaRepo.upsertJson(payload.analysisId, {
      voice_json: payload.voiceJson,
    });
    await this.gate.tryComplete(payload.analysisId);

    return { status: "success" };
  }
}
