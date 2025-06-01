import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { InterviewSessionQuestion } from "./interview.session.question.entity";

@Entity({ name: "interview_sessions" })
export class InterviewSession {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  user_id: string;

  @Column({ default: "pending" })
  status: "pending" | "ready" | "in_progress" | "completed" | "expired";

  @OneToMany(() => InterviewSessionQuestion, (q) => q.session, {
    cascade: true,
  })
  questions: InterviewSessionQuestion[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: "varchar", nullable: true })
  job_role: string;
}
