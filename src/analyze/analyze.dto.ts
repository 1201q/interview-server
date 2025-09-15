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

export class UploadAudioDto {
  @ApiProperty({
    type: "string",
    format: "binary",
    description: "업로드할 오디오 파일",
    nullable: true,
  })
  audio: any;
}
