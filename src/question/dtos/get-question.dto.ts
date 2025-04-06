import { IsIn } from "class-validator";
import { RoleType } from "../../common/interfaces/common.interface";

export class GetQuestionDto {
  @IsIn(["fe", "be", "android", "ios"])
  role: RoleType = "fe";
}
