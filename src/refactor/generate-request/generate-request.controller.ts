import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";

import { ApiOperation, ApiResponse, ApiParam, ApiTags } from "@nestjs/swagger";
import { GenerateRequestService } from "./generate-request.service";
import {
  CreateQuestionRequestDto,
  GenerateResponseDto,
} from "./generate-request.dto";

@ApiTags("generate-request")
@Controller("generate-request")
export class GenerateRequestController {
  constructor(private readonly generateService: GenerateRequestService) {}

  @Post()
  @ApiOperation({ summary: "이력서 및 채용공고 기반 질문 생성 요청" })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "요청이 생성되고 처리 시작.",
    type: GenerateResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  async createRequest(
    @Body() createDto: CreateQuestionRequestDto,
  ): Promise<GenerateResponseDto> {
    return this.generateService.createQuestionRequest(createDto);
  }

  @Get(":id")
  @ApiOperation({ summary: "생성된 질문 목록 조회" })
  @ApiParam({ name: "id", description: "GenerateRequest id" })
  @ApiResponse({ status: HttpStatus.OK, description: "생성된 질문들 반환" })
  async getGenerated(@Param("id") id: string) {
    return this.generateService.getQuestions(id);
  }
}
