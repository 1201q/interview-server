import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class RefineBodyDto {
  @ApiProperty({
    description: "transcript된 텍스트(보정할 텍스트)",
    type: String,
  })
  @IsString()
  @MinLength(1)
  transcript!: string;

  @ApiProperty({ description: "인터뷰일 경우 질문 텍스트", type: String })
  @IsOptional()
  @IsString()
  question?: string;

  @ApiProperty({ description: "프롬프트에 넣을 텍스트의 맥락", type: String })
  @IsOptional()
  @IsString()
  context?: string;
}
