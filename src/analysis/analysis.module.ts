import { Module } from "@nestjs/common";
import { AnalysisService } from "./analysis.service";
import { AnalysisController } from "./analysis.controller";
import { HttpModule } from "@nestjs/axios";

@Module({
  imports: [HttpModule],
  providers: [AnalysisService],
  controllers: [AnalysisController],
})
export class AnalysisModule {}
