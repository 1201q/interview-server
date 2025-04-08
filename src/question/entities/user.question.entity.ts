import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "user_questions" })
export class UserQuestion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  user_id: string;

  @Column()
  question_text: string;

  @Column({ type: "varchar", length: 10 })
  role: "user";
}
