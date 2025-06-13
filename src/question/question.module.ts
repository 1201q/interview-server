import { Module } from "@nestjs/common";

import { QuestionService } from "./question.service";
import { QuestionController } from "./question.controller";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuthModule } from "src/auth/auth.module";

import { BookmarkedQuestion } from "./entities/bookmarked.question.entity";
import { Question } from "./entities/question.entity";
import { OpenaiService } from "./openai.service";

import { PdfController } from "./pdf.controller";
import { FlaskModule } from "src/flask/flask.module";
import { QuestionGenerationRequest } from "./entities/question.generation.request";
import { GenerationController } from "./generate.controller";
import { GenerationService } from "./generate.service";
import { GeneratedQuestionItem } from "./entities/generated.question.items.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BookmarkedQuestion,
      Question,
      QuestionGenerationRequest,
      GeneratedQuestionItem,
    ]),
    AuthModule,
    FlaskModule,
  ],
  providers: [QuestionService, OpenaiService, GenerationService],
  controllers: [QuestionController, PdfController, GenerationController],
})
export class QuestionModule {}
