export interface EvaluationType {
  [key: string]: string;
}

export interface QuestionEvaluation {
  question_id: string;
  question_text: string;
  intent: string;
  core_criteria: EvaluationType;
  supplementary_criteria: EvaluationType;
  expected_keywords: string[];
}

export interface EvaluationStandard {
  job_role: string;
  question_evaluations: QuestionEvaluation[];
}

// whisper
export interface SegmentsType {
  avg_logprob: number;
  compression_ratio: number;
  end: number;
  id: number;
  no_speech_prob: number;
  seek: number;
  start: number;
  temperature: number;
  text: string;
  tokens: string[];
}

export interface WordsType {
  word: string;
  start: number;
  end: number;
}

export interface WhisperSttType {
  duration: number;
  language: string;
  task: string;
  text: string;
  segments: SegmentsType[];
  words: WordsType[];
}

// return words
export interface Words {
  before: string;
  after: string;
  start: number;
  end: number;
}

export interface Feedback {
  feedback: string;
  good: string[];
  bad: string[];
  grade: string;
}

export interface AnalysisResult {
  words: Words[];
  transcript: WhisperSttType;
  feedback: Feedback;
}

export interface AnalysisProgress {
  total: number;
  done: number;
  percent: number;
  status: "pending" | "loading" | "done";
}
