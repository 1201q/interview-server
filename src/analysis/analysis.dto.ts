import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";
import {
  TranscriptionSegment,
  TranscriptionWord,
} from "openai/resources/audio/transcriptions";

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

export class STTRequestDto extends UploadAudioDto {
  @ApiProperty({
    description: "질문 타입",
    enum: ["basic", "experience", "job_related", "expertise"],
    default: "experience",
  })
  @IsNotEmpty()
  section: "basic" | "experience" | "job_related" | "expertise";

  @ApiProperty({
    description: "질문 텍스트",
    required: false,
    default:
      "예약 시스템의 동시성 문제를 해결했다고 했는데, 그 상황에서 어떤 현상을 근거로 문제를 규정했고 왜 그 접근을 선택했는지, 적용 후 어떤 지표/현상이 개선되었는지 설명해주세요.",
  })
  @IsString()
  @IsOptional()
  questionText?: string;

  @ApiProperty({
    description: "직군",
    required: false,
    default: "백엔드 개발자",
  })
  @IsOptional()
  @IsString()
  jobRole?: string;
}

export class STTRefineDto {
  @ApiProperty({ description: "질문 텍스트", required: false })
  @IsString()
  @IsOptional()
  questionText?: string;

  @ApiProperty({
    description: "직군",
    required: false,
  })
  @IsOptional()
  @IsString()
  jobRole?: string;

  @ApiProperty({ description: "필사 텍스트", isArray: true })
  @IsArray()
  @IsNotEmpty()
  words: TranscriptionWord[];
}

export class STTRefineSegmentsDto {
  @ApiProperty({ description: "질문 텍스트", required: false })
  @IsString()
  @IsOptional()
  questionText?: string;

  @ApiProperty({
    description: "직군",
    required: false,
  })
  @IsOptional()
  @IsString()
  jobRole?: string;

  @ApiProperty({ description: "필사 텍스트", isArray: true })
  @IsArray()
  @IsNotEmpty()
  segments: TranscriptionSegment[];
}

export class FeedbackSegmentsDto {
  @ApiProperty({
    description: "질문 텍스트",
    required: false,
    default:
      "예약 시스템의 동시성 문제를 해결했다고 했는데, 그 상황에서 어떤 현상을 근거로 문제를 규정했고 왜 그 접근을 선택했는지, 적용 후 어떤 지표/현상이 개선되었는지 설명해주세요.",
  })
  @IsString()
  @IsOptional()
  questionText?: string;

  @ApiProperty({
    description: "직군",
    required: false,
    default: "백엔드 개발자",
  })
  @IsOptional()
  @IsString()
  jobRole?: string;

  @ApiProperty({
    description: "segments",
    isArray: true,
    default: [
      "음, 제가 경험한 동시성 문제는 심야 자습이나 안마의자 같은 예약 시스템에서 동시에 여러 사용자가 신청했을 때, 최대 인원을 추가해서 예약이 잡히는 현상이었습니다.",
      "처음에는 단순히 database 레벨에서 transaction만으로 해결하려고 했는데, 순간적으로 traffic이 몰릴 때 처리 속도가 따라가지 못하는 문제가 있었어요.",
      "그래서 더 빠른 처리와 일관성을 위해 인메모리 저장소인 Redis를 도입했고, 그 위에 Redisson client를 활용해서 distributed lock을 구현했습니다.",
      "단순 락이 아니라 TTL을 설정해서 일정 시간 내에 처리되지 않으면 자동으로 실패하도록 했고, transaction이 commit된 이후에만 락을 반납하는 방식으로 데이터 일관성을 보장했습니다.",
      "적용 이후에는 최대 인원 초과 예약 같은 현상이 사라졌고, 처리량 자체도 확연히 개선됐습니다.",
      "특히 사용자 피드백에서 예약이 꼬이지 않는다는 반응을 많이 받았고, monitoring 지표상에서도 예약 요청 성공률이 안정적으로 100%에 가까워졌습니다.",
    ],
  })
  @IsArray()
  @IsNotEmpty()
  segments: string[];
}

export class RubricDto {
  @ApiProperty({
    description: "질문 배열",
    required: true,
    default: [
      "첫 90일에 이 포지션에서 반드시 달성하고 싶은 한 가지 성과는 무엇인가요?",
      "협업에서 ‘극도의 투명함’을 실천하기 위해 평소에 유지하는 한 가지 루틴을 소개해 주세요.",
      "마이크로서비스 전환 당시 가장 까다로웠던 설계 트레이드오프 하나를 선택한 근거를 설명해 주세요.",
      "예약 시스템에서 최대 인원 초과 동시성 문제 해결 시 최종적으로 선택한 락 전략의 결정 근거를 들려주세요.",
      "GAuth 개발에서 토큰 수명/회수 설계와 관련해 가장 큰 보안 이슈 하나를 어떻게 해결했는지 요점을 말해 주세요.",
      "대규모 실시간 결제 트래픽에서 중복 요청과 재시도를 고려해 결제 API의 멱등성을 어떻게 보장하시겠습니까?",
      "분산 트랜잭션에서 saga 패턴과 two-phase commit 중 선택해야 한다면, 네트워크 분할과 보상 비용을 기준으로 어떤 상황에 무엇을 택하겠습니까?",
    ],
  })
  @IsArray()
  questionList: string[];

  @ApiProperty({
    description: "vector request id",
    required: true,
  })
  @IsString()
  vectorId: string;
}

export class VoiceAnalysisQueueDto {
  @ApiProperty({ description: "object name", required: true })
  @IsString()
  objectName: string;

  @ApiProperty({ description: "analysisId", required: true })
  @IsString()
  analysisId: string;
}
