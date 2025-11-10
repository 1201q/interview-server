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
  UseGuards,
  Req,
} from "@nestjs/common";

import {
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiCookieAuth,
} from "@nestjs/swagger";

import {
  CreateQuestionRequestDto,
  GQRequestResponseDto,
  InsertQuestionsBodyDto,
} from "./generate-question.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { FlaskServerService } from "../external-server/flask-server.service";
import { Response, Request } from "express";

import { QuestionRequestService } from "./question-request.service";
import { QuestionStreamService } from "./question-stream.service";
import { JwtAuthGuard } from "@/auth/guard/jwt-auh.guard";

@ApiTags("이력서 생성")
@Controller("generate-question")
export class GenerateQuestionController {
  constructor(
    private readonly flaskServerService: FlaskServerService,

    private readonly requestService: QuestionRequestService,
    private readonly streamService: QuestionStreamService,
  ) {}

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

    return { result: data.result };
  }

  @Post("create")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("accessToken")
  @ApiOperation({ summary: "질문 요청 생성" })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "새로운 질문 생성 요청",
    type: GQRequestResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateQuestionRequestDto,
    @Req() req: Request,
  ): Promise<GQRequestResponseDto> {
    const userId = req.user["id"];

    return this.requestService.createRequest({ ...dto, userId });
  }

  @Get(":requestId/stream")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("accessToken")
  @ApiOperation({ summary: "질문 생성 시작" })
  async stream(
    @Param("requestId") requestId: string,
    @Query("mock") mock: string,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const userId = req.user["id"];

    if (mock === "true") {
      return this.streamService.streamMockData(res);
    }

    return this.streamService.stream(requestId, userId, res);
  }

  @Get(":requestId/questions")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("accessToken")
  @ApiOperation({ summary: "생성된 질문 목록 조회" })
  @ApiParam({ name: "requestId", description: "request id" })
  @ApiResponse({ status: HttpStatus.OK, description: "생성된 질문들 반환" })
  async getQuestions(@Param("requestId") id: string, @Req() req: Request) {
    const userId = req.user["id"];
    return this.requestService.getQuestionsByRequestId(id, userId);
  }

  @Get(":requestId/request")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("accessToken")
  @ApiOperation({ summary: "request 조회" })
  @ApiParam({ name: "requestId", description: "request id" })
  @ApiResponse({ status: HttpStatus.OK, description: "request 반환" })
  async getRequest(
    @Param("requestId") id: string,
    @Req() req: Request,
  ): Promise<GQRequestResponseDto> {
    const userId = req.user["id"];
    return this.requestService.getRequest(id, userId);
  }

  @Post(":requestId/insert")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("accessToken")
  @ApiOperation({ summary: "request에 질문 추가" })
  @ApiParam({ name: "requestId", description: "request id" })
  @ApiResponse({ status: HttpStatus.OK, description: "추가 성공" })
  async insertQuestions(
    @Param("requestId") id: string,
    @Body() dto: InsertQuestionsBodyDto,
    @Req() req: Request,
  ) {
    const userId = req.user["id"];
    return this.requestService.insertQuestions(id, userId, dto);
  }
}
