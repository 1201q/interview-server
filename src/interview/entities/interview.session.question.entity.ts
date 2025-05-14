import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { InterviewSession } from "./interview.session.entity";
import { Question } from "src/question/entities/question.entity";

@Entity({ name: "interview_session_questions" })
export class InterviewSessionQuestion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => InterviewSession, (s) => s.questions, {
    onDelete: "CASCADE",
  })
  session: InterviewSession;

  @ManyToOne(() => Question, { eager: true })
  question: Question;

  @Column({ type: "int" })
  order: number;

  @Column({ default: "waiting" })
  status: "waiting" | "answering" | "submitted";

  @Column({ type: "timestamp", nullable: true })
  started_at: Date;

  @Column({ type: "timestamp", nullable: true })
  ended_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
