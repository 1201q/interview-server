import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "role_questions" })
export class RoleQuestion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  question_text: string;

  @Column({ type: "varchar", length: 10 })
  role: "fe" | "be" | "android" | "ios";
}
