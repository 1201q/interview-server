import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class EvalRequestDto {
  @ApiProperty({ description: "질문 텍스트", type: String })
  @IsString()
  @IsNotEmpty()
  questionText: string;

  @ApiProperty({
    description: "질문 타입",
    enum: ["basic", "experience", "job_related", "expertise"],
  })
  @IsNotEmpty()
  section: "basic" | "experience" | "job_related" | "expertise";

  @ApiProperty({ description: "필사 텍스트", type: String })
  @IsString()
  @IsNotEmpty()
  transcript: string;
}
