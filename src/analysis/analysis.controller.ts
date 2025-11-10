import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AnalysisService } from "./analysis.service";
import {
  AnalysesResultDto,
  AnalysesStatusesDto,
} from "@/common/types/analysis.types";
import { Response, Request } from "express";
import { OciDBService } from "@/external-server/oci-db.service";
import { JwtAuthGuard } from "@/auth/guard/jwt-auh.guard";

@ApiTags("분석")
@Controller("analysis")
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly oci: OciDBService,
  ) {}

  @Get(":sessionId/result")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("accessToken")
  @ApiOperation({
    summary: "분석 결과s",
  })
  async analysesResult(
    @Param("sessionId") sessionId: string,
    @Req() req: Request,
  ): Promise<AnalysesResultDto> {
    const userId = req.user["id"];
    return this.analysisService.getAnalysesResult(sessionId, userId);
  }

  @Get(":sessionId/:answerId/result")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("accessToken")
  @ApiOperation({
    summary: "분석 결과",
  })
  async analysisResult(
    @Param("sessionId") sessionId: string,
    @Param("answerId") answerId: string,
    @Req() req: Request,
  ): Promise<AnalysesResultDto> {
    const userId = req.user["id"];
    return this.analysisService.getAnalysisResult(sessionId, answerId, userId);
  }

  @Get(":sessionId/statuses")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("accessToken")
  @ApiOperation({
    summary: "분석 상태",
  })
  async statuses(
    @Param("sessionId") sessionId: string,
    @Req() req: Request,
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
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("accessToken")
  @ApiOperation({
    summary: "par",
  })
  async par(
    @Param("answerId") answerId: string,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const userId = req.user["id"];
    const objectName = await this.analysisService.getObjectName(
      answerId,
      userId,
    );
    const url = await this.oci.generatePresignedUrl(objectName);

    res.redirect(302, url);
  }

  @Get("result/bulk")
  @ApiOperation({ summary: "면접 분석 가져오기" })
  // @ApiResponse({ type: SessionResponseDto })
  @ApiCookieAuth("accessToken")
  async create(
    // @Body() body: CreateInterviewSessionBodyDto,
    @Req() req: Request,
  ) {
    const token = req.cookies.accessToken as string;
    const { id } = await this.authService.decodeAccessToken(token);

    // return this.sessionService.createSession({
    //   ...body,
    //   user_id: id,
    // });
  }

  @Get("results/list")
  @ApiOperation({ summary: "내가 진행한 과거 면접 분석 가져오기" })
  async list(@Req() req: Request) {
    const userId = req.user["id"];

    return await this.analysisService.getAnalysesList(userId);
  }
}
