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

import { AnalysisCallbackController } from "./analysis.callback.controller";
import { AnalysisFlowService } from "./analysis.flow.service";
import { AnalysisWorker } from "./analysis.worker";

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
  controllers: [AnalysisController, AnalysisCallbackController],
  providers: [
    OciDBService,
    AnalysisService,
    AnalysisFlowService,
    AnalysisWorker,
  ],
  exports: [AnalysisService, AnalysisFlowService],
})
export class AnalysisModule {}
