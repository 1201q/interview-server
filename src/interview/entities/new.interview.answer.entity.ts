import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import NewInterviewSession from "./new.interview.session.entity";
import { GeneratedQuestionItem } from "src/question-generator/entities/generated.question.items.entity";

@Entity({ name: "interview_answers" })
export class NewInterviewAnswer {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => NewInterviewSession, (s) => s.answers, {
    onDelete: "CASCADE",
  })
  session: NewInterviewSession;

  @ManyToOne(() => GeneratedQuestionItem, { eager: true, nullable: true })
  question: GeneratedQuestionItem;

  @Column({ type: "float" })
  order: number;

  @Column({ default: "main" })
  type: "main" | "followup";

  @Column({ type: "clob", nullable: true })
  followup_question_text: string;

  @Column({ default: "waiting" })
  status: "waiting" | "ready" | "answering" | "submitted";

  @Column({ type: "timestamp", nullable: true })
  started_at: Date;

  @Column({ type: "timestamp", nullable: true })
  ended_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: "clob", nullable: true })
  answer_text: string;

  @Column({ type: "varchar", nullable: true })
  audio_path: string;

  @Column({ default: "pending" })
  analysis_status: "pending" | "processing" | "completed" | "failed";

  @Column({ type: "clob", nullable: true })
  analysis_result: string;
}
