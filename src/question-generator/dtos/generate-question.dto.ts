import {
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { GenerateQuestionType } from "../../common/interfaces/common.interface";

export class GenerateQuestionFromGptDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  jobRole: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  topic: string;

  @IsIn([
    "concept",
    "comparison",
    "system_design",
    "implementation",
    "experience",
  ])
  question_type: GenerateQuestionType;
}

export class GenerateQuestionFromResumeDto {
  @IsString()
  @MinLength(100)
  @MaxLength(10000)
  resume_text: string;

  @IsString()
  @MinLength(100)
  @MaxLength(1000)
  recruitment_text: string;
}
