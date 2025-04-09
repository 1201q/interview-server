import { IsIn } from "class-validator";

export class GetUserQuestionDto {
  @IsIn(["user"])
  role: "user";
}
