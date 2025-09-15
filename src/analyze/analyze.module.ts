import { Module } from "@nestjs/common";
import { AuthModule } from "src/auth/auth.module";

import { AnalyzeService } from "./analyze.service";
import { AnalyzeController } from "./analyze.controller";
import { ExternalServerModule } from "src/external-server/external-server.module";

@Module({
  imports: [AuthModule, AnalyzeModule, ExternalServerModule],
  providers: [AnalyzeService],
  controllers: [AnalyzeController],
})
export class AnalyzeModule {}
