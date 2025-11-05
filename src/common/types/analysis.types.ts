// =========================================== status
type GenerateStatus = "pending" | "working" | "completed" | "failed";
type SessionStatus = "not_started" | "in_progress" | "completed" | "expired";
type QAStatus = "pending" | "processing" | "completed" | "failed";
type AnswerStatus = "waiting" | "ready" | "answering" | "submitted";

// =========================================== result
export interface AnalysesResultDto {
  session_id: string;
  job_role: string | null;
  analyses: AnalysisItem[];
}

export interface AnalysisItem {
  id: string;
  order: number;
  question_text: string;
  rubric: RubricItemDto;
  answer: {
    audio_path: string | null;
    segments: SegmentDto[];
  };
  feedback: FeedbackItemDto | null;
  voice: VoicePublic | null; // 축약된 보이스 지표
  face: FaceFrameState[] | null; // 얼굴 분석 데이터
}

export interface RubricItemDto {
  intent: string | null;
  required: string | null;
  optional: string | null;
  context: string | null;
}

export interface SegmentDto {
  id?: string | number;
  start: number;
  end: number;
  text: string;
  refined_text?: string;
}

// 이미 가지고 있는 타입을 그대로 써도 OK
export interface FeedbackItemDto {
  one_line: string;
  feedback: string;
  misconception: null | {
    summary: string;
    explanation: string;
    evidence: string;
  };
}

// 반환
export interface VoicePublic {
  duration_ms: number;
  speech_ms: number;
  silence_ms: number;
  filler_ms: number;
  ratios: {
    filler_ratio: number;
    silence_per_duration: number;
    silence_per_speech: number;
    silence_plus_filler_per_speech_wo_filler: number;
    speech_density: number;
  };
  fluency: { fillers_per_min: number };
  pause_hygiene: {
    avg_phrase_sec: number;
    long_pauses_count: number;
    long_pauses_per_min: number;
    longest_pause_ms: number;
    pause_distribution: { head: number; body: number; tail: number };
    phrase_len_sd: number;
  };
}

// ============================================ status
export interface AnalysesStatusesDto {
  session_id: string;
  session_status: string;
  job_role: string | null;
  statuses: AnalysesStatusesItem[];
}

export interface AnalysesStatusesItem {
  answer_id: string;
  order: number;
  question_text: string;
  answer_status: AnswerStatus;
  rubric_status: QAStatus;
  analysis_status: QAStatus;
  analysis_progress: AnalysisProgress;
}

export interface AnalysisProgress {
  overall: number;
  stt: boolean;
  refine: boolean;
  audio: boolean;
  feedback: boolean;
}

export interface AnalysesListDto {
  session_id: string;
  job_role: string | null;
  interview_started_at: Date;
  interview_completed_at: Date;

  rubric_status: QAStatus;
  analysis_completed: boolean;

  questions: {
    text: string[];
  };
}

export type GazeDirection = "left" | "right" | "up" | "down" | "center";
export type GazeState = {
  timestamp: number;
  direction: GazeDirection;
  facingVotes: Record<GazeDirection, number>;
  irisVotes: Record<GazeDirection, number>;
  blink: boolean;
  faceDetected: boolean;
};
export type EmotionVotes = {
  positive: number;
  negative: number;
};
export type EmotionState = {
  timestamp: number;
  votes: EmotionVotes;
};

export type FaceFrameState = {
  timestamp: number;
  gaze: GazeState;
  emotion: EmotionState;
  faceDetected: boolean;
};
