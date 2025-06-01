import { Type } from "class-transformer";
import { IsObject, IsOptional, IsString, IsUUID } from "class-validator";
import { AnalysisResult } from "src/common/interfaces/analysis.interface";

export class WebhookAnalysisDto {
  @IsUUID()
  question_id: string;

  @IsOptional()
  @IsObject()
  result?: AnalysisResult;

  @IsString()
  message: string;

  @IsString()
  status: "fail" | "success";

  @IsString()
  code:
    | "silent"
    | "too_short"
    | "stt_error"
    | "analysis_success"
    | "analysis_error";
}
