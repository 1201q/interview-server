import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { AnalysisService } from "./analysis.service";
import {
  AnalysesResultDto,
  AnalysesStatusesDto,
} from "@/common/types/analysis.types";
import { Response, Request } from "express";
import { OciDBService } from "@/external-server/oci-db.service";
import { AuthService } from "@/auth/auth.service";

@ApiTags("분석")
@Controller("analysis")
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly oci: OciDBService,
    private readonly authService: AuthService,
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
  @ApiCookieAuth("accessToken")
  async list(@Req() req: Request) {
    const token = req.cookies.accessToken as string;
    const { id } = await this.authService.decodeAccessToken(token);

    return await this.analysisService.getAnalysesList(id);
  }
}
