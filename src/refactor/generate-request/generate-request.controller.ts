import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";

import {
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiTags,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { GenerateRequestService } from "./generate-request.service";
import {
  CreateQuestionRequestDto,
  GenerateResponseDto,
} from "./generate-request.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { FlaskService } from "src/shared/flask/flask.service";

@ApiTags("이력서 생성")
@Controller("generate-request")
export class GenerateRequestController {
  constructor(
    private readonly generateService: GenerateRequestService,
    private readonly flaskService: FlaskService,
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

  @Get(":id")
  @ApiOperation({ summary: "생성된 질문 목록 조회" })
  @ApiParam({ name: "id", description: "GenerateRequest id" })
  @ApiResponse({ status: HttpStatus.OK, description: "생성된 질문들 반환" })
  async getGenerated(@Param("id") id: string) {
    return this.generateService.getQuestions(id);
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

    const data = await this.flaskService.extractPdfText(file, decodedFilename);

    if (!data.result || data.result.length < 100) {
      throw new BadRequestException(
        "이력서에서 충분한 텍스트를 추출하지 못했습니다. 파일을 다시 확인해주세요.",
      );
    }

    return { result: data.result };
  }
}
