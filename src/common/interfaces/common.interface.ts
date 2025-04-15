export type RoleType = "fe" | "be" | "android" | "ios";
export type QuestionType = "user" | "ai" | RoleType;

export interface User {
  name: string;
  email: string;
  user_id: string;
  provider: string;
}
