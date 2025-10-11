import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AnalysisService } from "./analysis.service";
import {
  AnalysesResultDto,
  AnalysesStatusesDto,
} from "@/common/types/analysis.types";
import { Response } from "express";
import { OciDBService } from "@/external-server/oci-db.service";

@ApiTags("분석")
@Controller("analysis")
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly oci: OciDBService,
  ) {}

  @Get(":sessionId/result")
  @ApiOperation({
    summary: "분석 결과s",
  })
  async analysesResult(
    @Param("sessionId") sessionId: string,
  ): Promise<AnalysesResultDto> {
    return this.analysisService.getAnalysesResult(sessionId);
  }

  @Get(":sessionId/:answerId/result")
  @ApiOperation({
    summary: "분석 결과",
  })
  async analysisResult(
    @Param("sessionId") sessionId: string,
    @Param("answerId") answerId: string,
  ): Promise<AnalysesResultDto> {
    return this.analysisService.getAnalysisResult(sessionId, answerId);
  }

  @Get(":sessionId/statuses")
  @ApiOperation({
    summary: "분석 상태",
  })
  async statuses(
    @Param("sessionId") sessionId: string,
  ): Promise<AnalysesStatusesDto> {
    return this.analysisService.getStatuses(sessionId);
  }

  @Get(":answerId/par_url")
  @ApiOperation({
    summary: "par_url",
  })
  async parUrl(@Param("answerId") answerId: string) {
    const objectName = await this.analysisService.getObjectName(answerId);

    const url = await this.oci.generatePresignedUrl(objectName);

    return url;
  }

  @Get(":answerId/par")
  @ApiOperation({
    summary: "par",
  })
  async par(@Param("answerId") answerId: string, @Res() res: Response) {
    const objectName = await this.analysisService.getObjectName(answerId);

    const url = await this.oci.generatePresignedUrl(objectName);

    res.redirect(302, url);
  }
}
