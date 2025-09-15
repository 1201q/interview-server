import { Module } from "@nestjs/common";
import { AuthModule } from "src/auth/auth.module";
import { AnalyzeService } from "./analyze.service";
import { AnalyzeController } from "./analyze.controller";
import { ExternalServerModule } from "src/external-server/external-server.module";

import { QueueModule } from "./queue/queue.module";

@Module({
  imports: [AuthModule, AnalyzeModule, ExternalServerModule, QueueModule],
  providers: [AnalyzeService],
  controllers: [AnalyzeController],
  exports: [AnalyzeService],
})
export class AnalyzeModule {}
