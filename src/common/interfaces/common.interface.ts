export type RoleType = "fe" | "be" | "android" | "ios";
export type QuestionType = "user" | "ai" | RoleType;

export interface User {
  name: string;
  email: string;
  user_id: string;
  provider: string;
}

export type GenerateQuestionType =
  | "concept"
  | "comparison"
  | "system_design"
  | "implementation"
  | "experience";

export interface GenerateQuestionFromResumeResult {
  basic: QuestionData[];
  experience: QuestionData[];
  job_related: QuestionData[];
  expertise: QuestionData[];
}

export interface QuestionData {
  question: string;
  based_on: string;
}
