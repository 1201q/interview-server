import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RubricDto, STTRequestDto } from "./analysis.dto";
import { AnalysisService } from "./analysis.service";
import { FileInterceptor } from "@nestjs/platform-express";

import { AnalysisFlowService } from "./analysis.flow.service";
import { InjectRepository } from "@nestjs/typeorm";
import { AnswerAnalysis } from "@/common/entities/entities";
import { Repository } from "typeorm";

@ApiTags("분석")
@Controller("analysis")
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly flow: AnalysisFlowService,

    @InjectRepository(AnswerAnalysis)
    private readonly repo: Repository<AnswerAnalysis>,
  ) {}

  @Post("/test/refine")
  @ApiOperation({
    summary: "stt -> refine 테스트",
  })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("audio"))
  async sttRefined(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: STTRequestDto,
  ) {
    if (!file) {
      throw new BadRequestException("audio 파일이 필요합니다.");
    }

    const res = await this.analysisService.transcript(file);

    const refinedSeg = await this.analysisService.refineSttSegments({
      segments: res.segments,
      questionText: dto.questionText,
      jobRole: dto.jobRole,
    });

    return { segments: res.segments.map((r) => r.text), refinedSeg };
  }

  @Post("/test/rubric")
  @ApiOperation({
    summary: "rubric 테스트",
  })
  async testRubric(@Body() dto: RubricDto) {
    const res = await this.analysisService.rubric(dto);
    return res;
  }

  @Post("/test/:answerId/start")
  async testStart(
    @Param("answerId") answerId: string,
    @Body() body: { sessionId: string; progress: any },
  ) {
    const res = await this.flow.addFullFlow({
      sessionId: body.sessionId,
      answerId,
    });

    return res;
  }

  @Get("/test/:answerId/status")
  async testStatus(@Param("answerId") answerId: string) {
    const data = await this.repo.findOne({
      where: { answer: { id: answerId } },
    });

    if (!data) {
      return { status: "not_found" };
    }

    return {
      status: data.status,
      progress: data.progress,
      parentJobId: data.bull_job_id,
    };
  }
}
