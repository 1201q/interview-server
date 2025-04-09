import { Type } from "class-transformer";
import { IsIn, IsNotEmpty, IsString, ValidateNested } from "class-validator";

export class CreateUserQuestionDto {
  @IsNotEmpty()
  @IsString()
  question_text: string;

  @IsIn(["user"])
  role: "user";
}

export class CreateUserQuestionArrayDto {
  @ValidateNested({ each: true })
  @Type(() => CreateUserQuestionDto)
  items: CreateUserQuestionDto[];
}
