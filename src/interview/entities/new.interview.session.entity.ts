import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { QuestionGenerationRequest } from "src/question-generator/entities/question.generation.request";
import { NewInterviewAnswer } from "./new.interview.answer.entity";

@Entity({ name: "interview_sessions" })
export default class NewInterviewSession {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  user_id: string;

  @Column({ default: "pending" })
  status: "pending" | "ready" | "in_progress" | "completed" | "expired";

  @ManyToOne(() => QuestionGenerationRequest, {
    nullable: true,
    onDelete: "SET NULL",
  })
  request: QuestionGenerationRequest;

  @OneToMany(() => NewInterviewAnswer, (q) => q.session, {
    cascade: true,
  })
  answers: NewInterviewAnswer[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
