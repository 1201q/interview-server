import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";

import { FlaskModule } from "src/shared/flask/flask.module";
import { QuestionGenerationRequest } from "./entities/question.generation.request";
import { QuestionGeneratorController } from "./question-generator.controller";
import { QuestionGeneratorService } from "./question-generator.service";
import { GeneratedQuestionItem } from "./entities/generated.question.items.entity";
import { OpenaiService } from "src/shared/openai/openai.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuestionGenerationRequest,
      GeneratedQuestionItem,
    ]),
    AuthModule,
    FlaskModule,
  ],
  providers: [QuestionGeneratorService, OpenaiService],
  controllers: [QuestionGeneratorController],
})
export class QuestionGeneratorModule {}
