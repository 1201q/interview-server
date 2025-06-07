import { QuestionService } from "./question.service";
import {
  BadRequestException,
  Body,
  Controller,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import {
  CreateQuestionArrayDto,
  CreateQuestionDto,
} from "./dtos/crate-question.dto";
import { GetQuestionDto } from "./dtos/get-question.dto";

import { JwtAuthGuard } from "src/auth/guard/jwt-auh.guard";
import { Request } from "express";
import { AuthService } from "src/auth/auth.service";
import { CreateUserQuestionArrayDto } from "./dtos/create-user-question.dto";
import { Question } from "./entities/question.entity";
import { GenerateQuestionFromGptDto } from "./dtos/generate-question.dto";
import { OpenaiService } from "./openai.service";
import { CreateAiQuestionArrayDto } from "./dtos/create-ai-question.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { Buffer } from "buffer";
import { FlaskService } from "src/flask/flask.service";

@Controller("pdf")
export class PdfController {
  constructor(
    private readonly questionService: QuestionService,
    private readonly authService: AuthService,
    private readonly openaiService: OpenaiService,
    private readonly flaskService: FlaskService,
  ) {}

  @Post("extract")
  @UseInterceptors(FileInterceptor("file"))
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    const decodedFilename = Buffer.from(file.originalname, "latin1").toString(
      "utf8",
    );

    const data = await this.flaskService.extractPdfText(file, decodedFilename);

    console.log(data);

    if (!data.result || data.result.length < 100) {
      throw new BadRequestException(
        "이력서에서 충분한 텍스트를 추출하지 못했습니다. 파일을 다시 확인해주세요.",
      );
    }

    return { result: data.result };
  }
}
