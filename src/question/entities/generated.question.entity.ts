import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

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

  @Column({ type: "clob", nullable: true })
  result_json: string;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;
}
