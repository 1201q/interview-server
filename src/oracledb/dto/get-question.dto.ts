import { IsIn } from "class-validator";
import { RoleType } from "../types/type";

export class GetQuestionDto {
  @IsIn(["fe", "be", "android", "ios"])
  role: RoleType = "fe";
}
