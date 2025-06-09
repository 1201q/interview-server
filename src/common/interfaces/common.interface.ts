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

export interface GeneratedQuestionFromResumeResult {
  question: string;
  based_on: string;
  section: "basic" | "experience" | "job_related" | "expertise";
}
