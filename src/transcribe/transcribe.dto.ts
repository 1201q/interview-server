import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateRealtimeTokenDto {
  @ApiPropertyOptional({
    description: "직군 힌트 (백엔드 개발자, 컨텐츠 마케터)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : undefined,
  )
  jobRole?: string;

  @ApiPropertyOptional({ description: "질문 텍스트" })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : undefined,
  )
  questionText?: string;

  @ApiPropertyOptional({
    description: "STT 바이어스 키워드 목록",
    isArray: true,
    type: String,
  })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayMinSize(0)
  @IsString({ each: true })
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (!Array.isArray(value)) return [];
    const uniq = Array.from(
      new Set(value.map((s) => String(s).trim()).filter(Boolean)),
    );
    return uniq.slice(0, 20);
  })
  keywords: string[] = [];
}

export class RefineBodyDto extends CreateRealtimeTokenDto {
  @ApiProperty({ description: "transcript된 텍스트 (보정할 텍스트)" })
  @IsString()
  @Transform(({ value }) => String(value ?? "").trim())
  transcript!: string;

  @ApiPropertyOptional({ description: "직전 세그먼트 꼬리" })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : undefined,
  )
  prevTail?: string;
}

export class RefineResponseDto {
  @ApiProperty({ description: "보정한 텍스트", type: String })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiProperty({
    description: "성공 상태",
    enum: ["failed", "completed"],
  })
  status: "failed" | "completed";
}
