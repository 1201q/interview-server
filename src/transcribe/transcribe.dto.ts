import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

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

export class CreateRealtimeTokenDto {
  @ApiPropertyOptional({
    description: "직군 힌트 (백엔드 개발자, 컨텐츠 마케터)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  jobRole?: string;

  @ApiPropertyOptional({ description: "질문 텍스트" })
  @IsOptional()
  @IsString()
  questionText?: string;

  @ApiPropertyOptional({
    description: "STT 바이어스 키워드 목록",
    isArray: true,
    type: String,
    example: [
      "AWS Systems Manager",
      "SSM",
      "EC2",
      "AMI",
      "Auto Scaling",
      "Bash",
      "Shell Script",
      "cron",
      "IAM role",
    ],
  })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayMinSize(0)
  @IsString({ each: true })
  keywords: string[] = [];
}
