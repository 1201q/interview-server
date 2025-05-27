import { Type } from "class-transformer";
import { IsNumber, IsString, IsUUID, ValidateNested } from "class-validator";

export class WebhookAnalysisDto {
  @IsUUID()
  question_id: string;

  @IsString()
  result?: string;

  @IsString()
  error?: string;
}
