import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { GeneratedQuestionItem } from "./generated.question.items.entity";

@Entity({ name: "generated_questions" })
export class GeneratedQuestion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "clob" })
  resume_text: string;

  @Column({ type: "clob" })
  recruitment_text: string;

  @Column({ default: "pending", length: 10 })
  status: "pending" | "working" | "completed" | "failed";

  @OneToMany(() => GeneratedQuestionItem, (item) => item.generated_question, {
    cascade: true,
  })
  items: GeneratedQuestionItem[];

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;
}
