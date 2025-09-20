import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { AnswerAnalysisRepository } from "../repos/answer.analysis.repository";
import { GateService } from "../services/gate.service";
import { OciDBService } from "src/external-server/oci-db.service";

@ApiTags("오디오 분석 콜백")
@Controller("analysis/audio")
export class AudioCallbackController {
  constructor(
    private readonly aaRepo: AnswerAnalysisRepository,
    private readonly oci: OciDBService,
    private readonly gate: GateService,
  ) {}

  @Post("/callback")
  async onAudioDone(@Body() payload: { analysisId: string; result: any }) {
    // await this.aaRepo.upsertJson(payload.analysisId, {
    //   voice_json: payload.voiceJson,
    // });
    // await this.gate.tryComplete(payload.analysisId);

    console.log(payload);

    return { status: "success" };
  }

  @Get("/par/:id")
  async test(@Param("id") id: string) {
    console.log(await this.oci.generatePresignedUrl(id));

    return { status: "success" };
  }
}
