import { Module } from "@nestjs/common";
import { AuthModule } from "src/auth/auth.module";

import { AnalyzeService } from "./analyze.service";
import { AnalyzeController } from "./analyze.controller";

@Module({
  imports: [AuthModule, AnalyzeModule],
  providers: [AnalyzeService],
  controllers: [AnalyzeController],
})
export class AnalyzeModule {}
