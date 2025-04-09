import { IsIn, IsNotEmpty, IsString, ValidateNested } from "class-validator";
import { RoleType } from "../../common/interfaces/common.interface";
import { Type } from "class-transformer";

export class CreateQuestionDto {
  @IsNotEmpty()
  @IsString()
  question_text: string;

  @IsIn(["fe", "be", "android", "ios"])
  role: RoleType;
}

export class CreateQuestionArrayDto {
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  items: CreateQuestionDto[];
}
