import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsNumber,
  IsUUID,
  ValidateNested,
} from "class-validator";

export class SessionResponseDto {
  @ApiProperty({ description: "session_id", type: String })
  session_id: string;
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
    default: "d2151465-878d-4996-9aba-c2dd0e830598",
  })
  @IsUUID()
  request_id: string;

  @ApiProperty({
    description: "메인으로 사용할 질문 목록 (질문ID, 순서)",
    type: [SessionQuestionItemDto],
    default: [
      { question_id: "97b93e5d-7805-4479-8b53-fc1f1a228bcd", order: 0 },
      { question_id: "2f981d94-7eee-4cb9-b065-e53b246fd059", order: 1 },
      { question_id: "9d0865f8-9a6d-463d-a30d-d2eab3b244df", order: 2 },
      { question_id: "6b9e60f4-64e6-4143-8c93-4cf230f8d582", order: 3 },
      { question_id: "ee470961-8ef6-405c-80ad-fae3f5b8e671", order: 4 },
      { question_id: "9a026b0a-f615-4a8c-b0da-9c765a67fde1", order: 5 },
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
export class SessionDetailDto {
  @ApiProperty({ type: String, format: "uuid" })
  session_id: string;

  @ApiProperty({ enum: ["not_started", "in_progress", "completed", "expired"] })
  status: "not_started" | "in_progress" | "completed" | "expired";

  @ApiProperty({ description: "생성일시", type: String, format: "date-time" })
  created_at: string;

  @ApiProperty({ type: [Object] })
  questions: any[];
}

export class SessionRubricDto {
  @ApiProperty({ type: String, format: "uuid" })
  session_id: string;

  @ApiProperty({ enum: ["pending", "processing", "completed", "failed"] })
  rubric_gen_status: "pending" | "processing" | "completed" | "failed";

  @ApiProperty({ type: Object })
  rubric_json: object | null;

  @ApiProperty({ description: "rubric_error", type: String })
  rubric_error: string | null;
}
