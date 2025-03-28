import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class createQuestionDto {
  @IsNotEmpty()
  @IsString()
  question_text: string;

  @IsIn(["fe", "be", "android", "ios"])
  role: "fe" | "be" | "android" | "ios";
}
