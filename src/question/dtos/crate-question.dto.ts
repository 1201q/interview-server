import { IsIn, IsNotEmpty, IsString } from "class-validator";
import { RoleType } from "../../common/interfaces/common.interface";

export class createQuestionDto {
  @IsNotEmpty()
  @IsString()
  question_text: string;

  @IsIn(["fe", "be", "android", "ios"])
  role: RoleType;
}
