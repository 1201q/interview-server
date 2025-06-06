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

@Module({
  imports: [
    TypeOrmModule.forFeature([BookmarkedQuestion, Question]),
    AuthModule,
    FlaskModule,
  ],
  providers: [QuestionService, OpenaiService],
  controllers: [QuestionController, PdfController],
})
export class QuestionModule {}
