import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AnalysisService } from "./analysis.service";
import { AnalysesResultDto } from "@/common/types/analysis.types";

@ApiTags("분석")
@Controller("analysis")
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get(":sessionId/result")
  @ApiOperation({
    summary: "분석 결과",
  })
  async result(
    @Param("sessionId") sessionId: string,
  ): Promise<AnalysesResultDto> {
    return this.analysisService.getResult(sessionId);
  }
}
