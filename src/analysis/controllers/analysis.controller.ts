import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  EvalRequestDto,
  STTRequestDto,
  UploadAudioDto,
  VoiceAnalysisQueueDto,
} from "../analysis.dto";
import { AnalysisService } from "../services/analysis.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { FlaskServerService } from "src/external-server/flask-server.service";
import { AnalysisOrchestratorService } from "../services/analysis.orchestrator.service";

@ApiTags("분석")
@Controller("analysis")
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly flaskService: FlaskServerService,
    private readonly orchestrator: AnalysisOrchestratorService,
  ) {}

  @Post()
  @ApiOperation({ summary: "질문 평가 요청" })
  async EvalAnswer(@Body() dto: EvalRequestDto) {
    return await this.analysisService.evaluateAnswer(dto);
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

    const res = await this.analysisService.transcript(file);

    const refined = await this.analysisService.refineSttWords({
      words: res.words.map((w) => w.word),
      questionText: dto.questionText,
      jobRole: dto.jobRole,
    });

    const finalText = refined.join(" ");

    if (mode) {
      const evalAnswer = await this.analysisService.evaluateAnswer({
        transcript: finalText,
        section: dto.section,
        questionText: dto.questionText,
      });
      return evalAnswer;
    }

    return refined;
  }

  @Get("/test/:answerId")
  async test(@Param("answerId") answerId: string) {
    return this.orchestrator.start(answerId);
  }

  @Post("/voice/queue/test")
  @ApiOperation({
    summary: "음성 분석 큐 테스트",
  })
  async analVoice(
    @Body() dto: VoiceAnalysisQueueDto,
    @Query("test") mode: boolean = true,
  ) {
    const res = await this.flaskService.enqueueAudioJob(dto);

    return res;
  }
}
