import { IsIn, IsNotEmpty, IsString } from "class-validator";
import { RoleType } from "../types/type";

export class createQuestionDto {
  @IsNotEmpty()
  @IsString()
  question_text: string;

  @IsIn(["fe", "be", "android", "ios"])
  role: RoleType;
}
