import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsUUID, ValidateNested } from "class-validator";

export class InterviewSessionDto {
  @IsUUID()
  session_id: string;
}

export class InterviewSessionWithOrderDto {
  @IsUUID()
  session_id: string;

  @Type(() => Number)
  @IsNumber()
  order: number;
}

export class InterviewSessionWithQuestionIdDto {
  @IsUUID()
  session_id: string;

  @IsUUID()
  question_id: string;
}

export class CreateInterviewSessionDto {
  @IsUUID()
  id: string;

  @IsNumber()
  order: number;
}

export class CreateInterviewSessionArrayDto {
  @ValidateNested({ each: true })
  @Type(() => CreateInterviewSessionDto)
  questions: CreateInterviewSessionDto[];

  @IsUUID()
  @IsOptional()
  generation_request_id?: string;
}
