import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString } from "class-validator";

export class UploadAudioDto {
  @ApiProperty({
    type: "string",
    format: "binary",
    description: "업로드할 오디오 파일",
    nullable: true,
  })
  audio: any;
}

export class SubmitAnswerDto extends UploadAudioDto {
  @ApiProperty({ description: "사용자 입력 답변 텍스트" })
  @IsString()
  answerText: string;

  @ApiProperty({ description: "faceData" })
  @IsOptional()
  @IsString()
  faceData?: string;
}

export class NextQuestionDto {
  @ApiProperty({ description: "다음 질문 ID", format: "uuid", nullable: true })
  questionId: string | null;

  @ApiProperty({ description: "질문 순서", type: Number, nullable: true })
  order: number | null;

  @ApiProperty({
    description: "질문 타입",
    enum: ["main", "followup"],
    nullable: true,
  })
  type: "main" | "followup" | null;

  @ApiProperty({ description: "질문 텍스트", nullable: true })
  text: string | null;
}

export class TestNextQuestionDto extends NextQuestionDto {
  @ApiProperty({ description: "다음 질문 ID", format: "uuid", nullable: true })
  answerId: string | null;
}

export class SubmitAnswerResponseDto {
  @ApiProperty({
    description: "다음 질문",
    type: NextQuestionDto,
    nullable: true,
  })
  next: NextQuestionDto;

  @ApiProperty({ description: "세션 완료 여부", default: false })
  finished: boolean;
}

export class TestSubmitAnswerResponseDto {
  @ApiProperty({
    description: "다음 질문",
    type: TestNextQuestionDto,
    nullable: true,
  })
  next: TestNextQuestionDto;

  @ApiProperty({ description: "세션 완료 여부", default: false })
  finished: boolean;
}
