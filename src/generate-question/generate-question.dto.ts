import { MOCK_INSERT_QUESTIONS } from "@/common/constants/mock-insert-questions";
import { QuestionSection } from "@/common/interfaces/common.interface";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from "class-validator";

export class CreateQuestionRequestDto {
  @ApiProperty({ description: "이력서 텍스트", type: String })
  @IsString()
  @IsNotEmpty()
  resume_text: string;

  @ApiProperty({ description: "채용공고 텍스트", type: String })
  @IsString()
  @IsNotEmpty()
  job_text: string;
}

// insert
export class QuestionItemDto {
  @ApiProperty({ description: "text", format: "string" })
  @IsString()
  text: string;

  @ApiProperty({ description: "based_on", type: "string" })
  @IsString()
  based_on: string;

  @ApiProperty({
    description: "section",
    enum: ["basic", "experience", "job_related", "expertise"],
  })
  @IsString()
  section: QuestionSection;
}

export class InsertQuestionsBodyDto {
  @ApiProperty({
    description: "추가할 질문 목록",
    type: [QuestionItemDto],
    default: MOCK_INSERT_QUESTIONS,
  })
  @ValidateNested({ each: true })
  @Type(() => QuestionItemDto)
  @ArrayNotEmpty()
  questions: QuestionItemDto[];
}

export class GQRequestResponseDto {
  @ApiProperty({ description: "생성 요청 ID", type: String })
  request_id: string;

  @ApiProperty({
    description: "상태",
    enum: ["pending", "working", "completed", "failed"],
  })
  status: "pending" | "working" | "completed" | "failed";
}
