import { Module } from "@nestjs/common";
import { AuthModule } from "src/auth/auth.module";
import { AnalysisService } from "./services/analysis.service";
import { AnalysisController } from "./controllers/analysis.controller";
import { ExternalServerModule } from "src/external-server/external-server.module";

import { QueueModule } from "../external-server/queue.module";
import { SttWorker } from "./workers/stt.worker";
import { RefineWorker } from "./workers/refine.worker";
import { FeedbackWorker } from "./workers/feedback.worker";
import { AudioWorker } from "./workers/audio.worker";
import { OciDBService } from "src/external-server/oci-db.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  Answer,
  AnswerAnalysis,
  GenerateRequest,
  InterviewSession,
  Question,
  SessionQuestion,
} from "src/common/entities/entities";
import { OpenaiModule } from "@/openai/openai.module";
import { RubricProducer } from "./producer/rubric.producer";
import { RubricWorker } from "./workers/rubric.worker";
import { SttProducer } from "./producer/stt.producer";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InterviewSession,
      SessionQuestion,
      Question,
      GenerateRequest,
      AnswerAnalysis,
      Answer,
    ]),
    AuthModule,
    ExternalServerModule,
    QueueModule,
    OpenaiModule,
  ],
  controllers: [AnalysisController],
  providers: [
    AnalysisService,
    OciDBService,
    SttWorker,
    RefineWorker,
    FeedbackWorker,
    AudioWorker,
    RubricProducer,
    RubricWorker,
    SttProducer,
  ],
  exports: [AnalysisService, RubricProducer, SttProducer],
})
export class AnalysisModule {}
