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
import { GenerateQuestionFromResumeDto } from "./dtos/generate-question.dto";
import { QuestionGeneratorService } from "./question-generator.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { FlaskService } from "src/shared/flask/flask.service";

@Controller("question/generate")
export class QuestionGeneratorController {
  constructor(
    private readonly generationService: QuestionGeneratorService,
    private readonly flaskService: FlaskService,
  ) {}

  @Post("new")
  async createQuestion(@Body() body: GenerateQuestionFromResumeDto) {
    const { resume_text, recruitment_text } = body;

    const result = await this.generationService.createGenerationRequest({
      resume_text,
      recruitment_text,
    });

    return { id: result.id, status: result.status };
  }

  @Get("/:id")
  async getQuestions(@Param("id") id: string) {
    const data = await this.generationService.getGeneratedQuestions(id);

    return data;
  }

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
