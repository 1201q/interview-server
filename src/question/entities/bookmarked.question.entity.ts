import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Question } from "./question.entity";

@Entity({ name: "bookmarked_questions" })
export class BookmarkedQuestion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  user_id: string;

  @Column()
  question_id: string;

  @ManyToOne(() => Question, { onDelete: "CASCADE" })
  @JoinColumn({ name: "question_id" })
  question: Question;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;
}
