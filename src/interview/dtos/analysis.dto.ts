import { Type } from "class-transformer";
import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";

export class WebhookAnalysisDto {
  @IsUUID()
  question_id: string;

  @IsOptional()
  @IsObject()
  result?: any;

  @IsOptional()
  @IsString()
  error?: string;
}
