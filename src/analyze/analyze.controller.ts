import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { EvalRequestDto, STTRequestDto, UploadAudioDto } from "./analyze.dto";
import { AnalyzeService } from "./analyze.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { FlaskServerService } from "src/external-server/flask-server.service";
import { JobsService } from "./queue/jobs.service";

@ApiTags("분석")
@Controller("analyze")
export class AnalyzeController {
  constructor(
    private readonly analyzeService: AnalyzeService,
    private readonly jobsService: JobsService,
    private readonly flaskService: FlaskServerService,
  ) {}

  @Post()
  @ApiOperation({ summary: "질문 평가 요청" })
  async EvalAnswer(@Body() dto: EvalRequestDto) {
    return await this.analyzeService.evaluateAnswer(dto);
  }

  @Post("/voice/test")
  @ApiOperation({
    summary: "음성 분석 테스트",
  })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("audio"))
  async testUpload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadAudioDto,
  ) {
    if (!file) {
      throw new BadRequestException("audio 파일이 필요합니다.");
    }

    const res = await this.flaskService.getVoiceMetrics(file);

    return res;
  }

  @Post("/stt/test")
  @ApiOperation({
    summary: "stt 분석 테스트",
  })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("audio"))
  async sttUpload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: STTRequestDto,
    @Query("eval") mode: boolean = false,
  ) {
    if (!file) {
      throw new BadRequestException("audio 파일이 필요합니다.");
    }

    const res = await this.analyzeService.transcript(file);

    const refined = await this.analyzeService.refineSttWords({
      words: res.words.map((w) => w.word),
      questionText: dto.questionText,
      jobRole: dto.jobRole,
    });

    const finalText = refined.join(" ");

    if (mode) {
      const evalAnswer = await this.analyzeService.evaluateAnswer({
        transcript: finalText,
        section: dto.section,
        questionText: dto.questionText,
      });
      return evalAnswer;
    }

    return refined;
  }

  @Get("/test")
  async test() {
    this.jobsService.enqueueAnalyze({ answerId: "@!@#!$", url: "!" });
    return "!";
  }
}
