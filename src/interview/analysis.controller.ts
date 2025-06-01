import { Body, Controller, Get, Param, Post } from "@nestjs/common";

import { WebhookAnalysisDto } from "./dtos/analysis.dto";
import { AnalysisService } from "./analysis.service";

@Controller("analysis")
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post("webhook")
  async handleWebhook(@Body() body: WebhookAnalysisDto) {
    const { question_id, result, message, status } = body;

    console.log(result);

    if (status === "fail") {
      await this.analysisService.markAnalysisFailed(question_id);
      console.log(`${question_id} 실패`);

      return { status: "fail", message: message };
    }

    await this.analysisService.completeAnalysis(question_id, result);
    console.log(`${question_id} 성공`);
    return { status: "ok" };
  }

  @Get(":question_id")
  async getQ(@Param("question_id") question_id: string) {
    const result = await this.analysisService.getAnalysisResult(question_id);

    console.log(JSON.parse(result.analysis_result));

    return result;
  }

  @Get("progress/:session_id")
  async getProgress(@Param("session_id") session_id: string) {
    const result = await this.analysisService.getAnalysisProgress(session_id);

    console.log(result);
    return result;
  }
}
