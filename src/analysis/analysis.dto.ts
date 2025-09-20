import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class EvalRequestDto {
  @ApiProperty({ description: "질문 텍스트", type: String })
  @IsString()
  @IsNotEmpty()
  questionText: string;

  @ApiProperty({
    description: "질문 타입",
    enum: ["basic", "experience", "job_related", "expertise"],
  })
  @IsNotEmpty()
  section: "basic" | "experience" | "job_related" | "expertise";

  @ApiProperty({ description: "필사 텍스트", type: String })
  @IsString()
  @IsNotEmpty()
  transcript: string;
}

export class UploadAudioDto {
  @ApiProperty({
    type: "string",
    format: "binary",
    description: "업로드할 오디오 파일",
    nullable: true,
  })
  audio: any;
}

export class STTRequestDto extends UploadAudioDto {
  @ApiProperty({
    description: "질문 타입",
    enum: ["basic", "experience", "job_related", "expertise"],
    default: "experience",
  })
  @IsNotEmpty()
  section: "basic" | "experience" | "job_related" | "expertise";

  @ApiProperty({ description: "질문 텍스트", required: false })
  @IsString()
  @IsOptional()
  questionText?: string;

  @ApiProperty({
    description: "직군",
    required: false,
  })
  @IsOptional()
  @IsString()
  jobRole?: string;
}

export class STTRefineDto {
  @ApiProperty({ description: "질문 텍스트", required: false })
  @IsString()
  @IsOptional()
  questionText?: string;

  @ApiProperty({
    description: "직군",
    required: false,
  })
  @IsOptional()
  @IsString()
  jobRole?: string;

  @ApiProperty({ description: "필사 텍스트", isArray: true })
  @IsArray()
  @IsNotEmpty()
  words: string[];
}

export class VoiceAnalysisQueueDto {
  @ApiProperty({ description: "object name", required: true })
  @IsString()
  objectName: string;

  @ApiProperty({ description: "analysisId", required: true })
  @IsString()
  analysisId: string;
}
