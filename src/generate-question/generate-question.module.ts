import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";

import { VectorStoreService } from "src/external-server/vector-store.service";

import { GenerateQuestionController } from "./generate-question.controller";
import {
  Question,
  GenerateRequest,
  InterviewSession,
} from "../common/entities/entities";
import { ExternalServerModule } from "../external-server/external-server.module";

import { OpenaiModule } from "@/openai-service/openai.module";
import { QuestionRequestService } from "./question-request.service";
import { QuestionStreamService } from "./question-stream.service";
import { QuestionGenerationPipeline } from "./question-generation.pipeline";
import { EventStreamService } from "./event-stream.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([GenerateRequest, Question, InterviewSession]),
    AuthModule,
    ExternalServerModule,
    OpenaiModule,
  ],
  providers: [
    VectorStoreService,
    QuestionRequestService,
    QuestionStreamService,
    QuestionGenerationPipeline,
    EventStreamService,
  ],
  controllers: [GenerateQuestionController],
})
export class GenerateQuestionModule {}
