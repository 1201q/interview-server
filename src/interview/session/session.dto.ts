import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsNumber,
  IsOptional,
  IsUUID,
  ValidateNested,
} from "class-validator";

export class GenerateResponseDto {
  @ApiProperty({ description: "생성 요청 ID", type: String })
  id: string;

  @ApiProperty({
    description: "요청 상태",
    enum: ["completed", "failed"],
  })
  status: "completed" | "failed";
}

export class StartSessionResponseDto {
  @ApiProperty({ description: "세션 ID", type: String })
  id: string;

  @ApiProperty({
    description: "세션 상태",
    enum: ["not_started", "in_progress", "completed", "expired"],
  })
  status: "not_started" | "in_progress" | "completed" | "expired";
}

export class SessionQuestionItemDto {
  @ApiProperty({ description: "질문 ID", format: "uuid" })
  @IsUUID()
  question_id: string;

  @ApiProperty({ description: "질문 순서", type: Number })
  @IsNumber()
  order: number;
}

// create
export class CreateInterviewSessionBodyDto {
  @ApiProperty({
    description: "request ID",
    type: "string",
    format: "uuid",
    default: "5571689e-2e6a-4e98-b727-92835552b23f",
  })
  @IsUUID()
  request_id: string;

  @ApiProperty({
    description: "메인으로 사용할 질문 목록 (질문ID, 순서)",
    type: [SessionQuestionItemDto],
    default: [
      { question_id: "28d1d52a-7efd-4a20-87a3-9372f0fc45f1", order: 0 },
      { question_id: "3ef93b01-f463-4286-b0bf-9596d74b673e", order: 1 },
    ],
  })
  @ValidateNested({ each: true })
  @Type(() => SessionQuestionItemDto)
  @ArrayNotEmpty()
  @ArrayUnique((o: SessionQuestionItemDto) => o.question_id, {
    message: "questionId must be unique",
  })
  questions: SessionQuestionItemDto[];
}

export class CreateInterviewSessionDto extends CreateInterviewSessionBodyDto {
  @ApiProperty({ description: "로그인한 사용자 ID", format: "uuid" })
  @IsUUID()
  user_id: string;
}
// create

export class InterviewSessionDetailDto {
  @ApiProperty({ type: String, format: "uuid" })
  id: string;

  @ApiProperty({ enum: ["not_started", "in_progress", "completed", "expired"] })
  status: "not_started" | "in_progress" | "completed" | "expired";

  @ApiProperty({ description: "생성일시", type: String, format: "date-time" })
  created_at: string;

  @ApiProperty({ type: [Object] })
  questions: any[];
}

export class InterviewJobRoleDto {
  @ApiProperty({ description: "직군 이름", type: String })
  @IsOptional()
  job_role?: string;

  @ApiProperty({
    description: "요청 상태",
    enum: ["completed", "failed"],
  })
  status: "completed" | "failed";
}

// stt
export class KeywordsForSttItemDto {
  @ApiProperty({ description: "질문 ID", format: "uuid" })
  @IsUUID()
  id: string;

  @ApiProperty({ description: "keywords" })
  @IsArray()
  stt_keywords: string[];
}

export class KeywordsForSttDto {
  @ValidateNested({ each: true })
  @Type(() => KeywordsForSttItemDto)
  @ArrayNotEmpty()
  @ArrayUnique((o: KeywordsForSttItemDto) => o.id, {
    message: "questionId must be unique",
  })
  keywords: KeywordsForSttItemDto[];
}
