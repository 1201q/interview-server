import { Type } from "class-transformer";
import { IsNumber, IsUUID, ValidateNested } from "class-validator";

export class InterviewSessionDto {
  @IsUUID()
  session_id: string;
}

export class InterviewSessionWithOrderDto {
  @IsUUID()
  session_id: string;

  @IsNumber()
  order: number;
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
}
