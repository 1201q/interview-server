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

import {
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiTags,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { GenerateQuestionService } from "./generate-question.service";
import {
  CreateQuestionRequestDto,
  GenerateResponseDto,
  GQRequestResponseDto,
} from "./generate-question.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { FlaskServerService } from "../external-server/flask-server.service";
import { Response } from "express";

import { OpenAIService } from "@/openai/openai.service";

@ApiTags("이력서 생성")
@Controller("generate-question")
export class GenerateQuestionController {
  constructor(
    private readonly generateService: GenerateQuestionService,
    private readonly ai: OpenAIService,
    private readonly flaskServerService: FlaskServerService,
  ) {}

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

  @Post("new")
  @ApiOperation({ summary: "이력서 및 채용공고 기반 질문 요청 생성" })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "새로운 질문 생성 요청",
    type: GenerateResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  async createRequest2(
    @Body() createDto: CreateQuestionRequestDto,
  ): Promise<GenerateResponseDto> {
    return this.generateService.createRequest(createDto);
  }

  @Get("test/:id")
  async test(
    @Param("id") id: string,
    @Query("mock") mock: string,
    @Res() res: Response,
  ) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const isMock = mock === "true";

    // test

    if (isMock) {
      await this.generateService.streamMockData(res);
    } else {
      await this.generateService.streamQuestionGenerator(id, res);
    }
  }

  @Get(":id/questions")
  @ApiOperation({ summary: "생성된 질문 목록 조회" })
  @ApiParam({ name: "id", description: "GenerateRequest id" })
  @ApiResponse({ status: HttpStatus.OK, description: "생성된 질문들 반환" })
  async getGenerated(@Param("id") id: string) {
    return this.generateService.getQuestions(id);
  }

  @Get(":id/request")
  @ApiOperation({ summary: "request 조회" })
  @ApiParam({ name: "id", description: "GenerateRequest id" })
  @ApiResponse({ status: HttpStatus.OK, description: "request 반환" })
  async getRequest(@Param("id") id: string): Promise<GQRequestResponseDto> {
    return this.generateService.getRequest(id);
  }

  @Post("extract")
  @ApiOperation({ summary: "PDF에서 텍스트를 추출" })
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.OK, description: "텍스트 추출 성공" })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "텍스트 부족 또는 파일 오류",
  })
  async extract(@UploadedFile() file: Express.Multer.File) {
    const decodedFilename = Buffer.from(file.originalname, "latin1").toString(
      "utf8",
    );

    const data = await this.flaskServerService.extractTextFromPDF(
      file,
      decodedFilename,
    );

    if (!data.result || data.result.length < 100) {
      throw new BadRequestException(
        "이력서에서 충분한 텍스트를 추출하지 못했습니다. 파일을 다시 확인해주세요.",
      );
    }

    console.log(data);

    return { result: data.result };
  }

  @Post("/test/embedding")
  @ApiOperation({ summary: "이력서 및 채용공고 기반 질문 생성 요청" })
  @HttpCode(HttpStatus.CREATED)
  async embedding(@Body() createDto: CreateQuestionRequestDto): Promise<any> {
    return this.ai.saveToVectorStore({
      resumeText: createDto.resume_text,
      jobText: createDto.job_text,
      requestId: "test-embedding2",
    });
  }

  @Post("/test/summary")
  @ApiOperation({ summary: "이력서 및 채용공고 기반 질문 생성 요청" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        requestId: {
          type: "string",
        },
      },
    },
  })
  @HttpCode(HttpStatus.CREATED)
  async summary(@Body() dto: { requestId: string }): Promise<any> {
    return this.generateService.summary(dto.requestId);
  }
}
