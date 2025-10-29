import { Module } from "@nestjs/common";
import { AuthModule } from "src/auth/auth.module";
import { AnalysisService } from "./analysis.service";
import { AnalysisController } from "./analysis.controller";
import { ExternalServerModule } from "src/external-server/external-server.module";

import { QueueModule } from "../external-server/queue.module";
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
import { OpenaiModule } from "@/llm/openai.module";

import { AnalysisFlowService } from "./analysis.flow.service";
import { AnalysisWorker } from "./analysis.worker";
import { SessionPrepFlowService } from "./session-prep.flow.service";
import { SessionPrepWorker } from "./session-prep.worker";
import { AnalysisSseController } from "./analysis.sse.controller";
import { AnalysisEventsService } from "./analysis.events.service";

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
  controllers: [AnalysisController, AnalysisSseController],
  providers: [
    OciDBService,
    AnalysisService,
    AnalysisFlowService,
    AnalysisWorker,
    SessionPrepFlowService,
    SessionPrepWorker,
    AnalysisEventsService,
  ],
  exports: [AnalysisService, AnalysisFlowService, SessionPrepFlowService],
})
export class AnalysisModule {}
