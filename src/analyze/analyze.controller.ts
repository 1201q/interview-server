import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Res,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { EvalRequestDto } from "./analyze.dto";
import { AnalyzeService } from "./analyze.service";

@ApiTags("분석")
@Controller("analyze")
export class AnalyzeController {
  constructor(private readonly analyzeService: AnalyzeService) {}

  @Post()
  @ApiOperation({ summary: "질문 평가 요청" })
  async EvalAnswer(@Body() dto: EvalRequestDto) {
    return await this.analyzeService.evaluateAnswer(dto);
  }
}
