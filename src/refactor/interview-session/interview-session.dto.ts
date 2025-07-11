import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsNumber,
  IsUUID,
  ValidateNested,
} from "class-validator";

export class SessionQuestionItemDto {
  @ApiProperty({ description: "질문 ID", format: "uuid" })
  @IsUUID()
  question_id: string;

  @ApiProperty({ description: "질문 순서", type: Number })
  @IsNumber()
  order: number;
}

export class CreateInterviewSessionDto {
  @ApiProperty({
    description: "로그인한 사용자 ID",
    type: "string",
    format: "uuid",
  })
  @IsUUID()
  user_id: string;

  @ApiProperty({
    description: "request ID",
    type: "string",
    format: "uuid",
  })
  @IsUUID()
  request_id: string;

  @ApiProperty({
    description: "메인으로 사용할 질문 목록 (질문ID, 순서)",
    type: [SessionQuestionItemDto],
  })
  @ValidateNested({ each: true })
  @Type(() => SessionQuestionItemDto)
  @ArrayNotEmpty()
  @ArrayUnique((o: SessionQuestionItemDto) => o.question_id, {
    message: "questionId must be unique",
  })
  questions: SessionQuestionItemDto[];
}

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
