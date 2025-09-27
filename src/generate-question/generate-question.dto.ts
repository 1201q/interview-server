import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateQuestionRequestDto {
  @ApiProperty({ description: "이력서 텍스트", type: String })
  @IsString()
  @IsNotEmpty()
  resume_text: string;

  @ApiProperty({ description: "채용공고 텍스트", type: String })
  @IsString()
  @IsNotEmpty()
  job_text: string;
}

export class GenerateResponseDto {
  @ApiProperty({ description: "생성 요청 ID", type: String })
  id: string;

  @ApiProperty({
    description: "요청 상태",
    enum: ["completed", "failed"],
  })
  status: "completed" | "failed";
}

export class GQRequestResponseDto {
  @ApiProperty({ description: "생성 요청 ID", type: String })
  id: string;

  @ApiProperty({
    description: "상태",
    enum: ["pending", "working", "completed", "failed"],
  })
  status: "pending" | "working" | "completed" | "failed";
}
