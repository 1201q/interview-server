import { IsIn, IsNotEmpty, IsString, MaxLength } from "class-validator";
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
