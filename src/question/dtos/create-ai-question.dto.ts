import { Type } from "class-transformer";
import { IsIn, IsNotEmpty, IsString, ValidateNested } from "class-validator";

export class CreateAiQuestionDto {
  @IsNotEmpty()
  @IsString()
  question_text: string;

  @IsIn(["ai"])
  role: "ai";
}

export class CreateAiQuestionArrayDto {
  @ValidateNested({ each: true })
  @Type(() => CreateAiQuestionDto)
  items: CreateAiQuestionDto[];
}
