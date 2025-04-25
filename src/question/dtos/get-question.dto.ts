import { IsIn, IsOptional } from "class-validator";
import { RoleType } from "../../common/interfaces/common.interface";

export class GetQuestionDto {
  @IsOptional()
  @IsIn(["fe", "be", "android", "ios"])
  role?: RoleType;
}
