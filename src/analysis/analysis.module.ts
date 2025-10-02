import { Module } from "@nestjs/common";
import { AuthModule } from "src/auth/auth.module";
import { AnalysisService } from "./services/analysis.service";
import { AnalysisController } from "./controllers/analysis.controller";
import { ExternalServerModule } from "src/external-server/external-server.module";

import { QueueModule } from "../external-server/queue.module";
import { AudioCallbackController } from "./controllers/audio.callback.controller";
import { AnswerAnalysisRepository } from "./repos/answer.analysis.repository";
import { GateService } from "./services/gate.service";
import { AnalysisOrchestratorService } from "./services/analysis.orchestrator.service";
import { SttWorker } from "./workers/stt.worker";
import { RefineWorker } from "./workers/refine.worker";
import { FeedbackWorker } from "./workers/feedback.worker";
import { AudioWorker } from "./workers/audio.worker";
import { OciDBService } from "src/external-server/oci-db.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  GenerateRequest,
  InterviewSession,
  Question,
  SessionQuestion,
} from "src/common/entities/entities";
import { OpenaiModule } from "@/openai/openai.module";
import { RubricProducer } from "./producer/rubric.producer";
import { RubricWorker } from "./workers/rubric.worker";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InterviewSession,
      SessionQuestion,
      Question,
      GenerateRequest,
    ]),
    AuthModule,
    ExternalServerModule,
    QueueModule,
    OpenaiModule,
  ],
  controllers: [AnalysisController, AudioCallbackController],
  providers: [
    AnalysisService,
    OciDBService,
    AnswerAnalysisRepository,
    GateService,
    AnalysisOrchestratorService,
    SttWorker,
    RefineWorker,
    FeedbackWorker,
    AudioWorker,
    RubricProducer,
    RubricWorker,
  ],
  exports: [AnalysisService, RubricProducer],
})
export class AnalysisModule {}
