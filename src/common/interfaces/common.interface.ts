export interface User {
  name: string;
  email: string;
  user_id: string;
  provider: string;
}

export type QuestionSection =
  | "basic"
  | "experience"
  | "job_related"
  | "expertise";

export interface QuestionItem {
  question: string;
  based_on: string;
  section: QuestionSection;
}
