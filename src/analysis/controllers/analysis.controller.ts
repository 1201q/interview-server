import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RubricDto, STTRequestDto } from "../analysis.dto";
import { AnalysisService } from "../services/analysis.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { FlaskServerService } from "src/external-server/flask-server.service";

@ApiTags("분석")
@Controller("analysis")
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly flaskService: FlaskServerService,
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
}
