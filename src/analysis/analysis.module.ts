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
import { InterviewSession } from "src/common/entities/entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([InterviewSession]),
    AuthModule,
    ExternalServerModule,
    QueueModule,
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
  ],
  exports: [AnalysisService],
})
export class AnalysisModule {}
