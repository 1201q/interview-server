import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";
import { QuestionType } from "../../common/interfaces/common.interface";

@Entity({ name: "questions" })
export class Question {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  question_text: string;

  @Column({ type: "varchar", length: 10 })
  role: QuestionType;

  @Column({ type: "varchar", length: 10 })
  creator_type: "user" | "admin";

  @Column({ type: "varchar", nullable: true })
  user_id: string | null;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;
}
