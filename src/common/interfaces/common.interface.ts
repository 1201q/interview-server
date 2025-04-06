export type RoleType = "fe" | "be" | "android" | "ios";
export interface User {
  name: string;
  email: string;
  user_id: string;
  provider: string;
}
