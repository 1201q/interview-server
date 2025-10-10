import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Index,
  UpdateDateColumn,
} from "typeorm";
import { Relation } from "typeorm";

export type GenerateStatus = "pending" | "working" | "completed" | "failed";
export type SessionStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "expired";
export type QAStatus = "pending" | "processing" | "completed" | "failed";
export type AnswerStatus = "waiting" | "ready" | "answering" | "submitted";

@Entity({ name: "generate_requests" })
@Index("idx_generate_requests_status_created", ["status", "created_at"])
export class GenerateRequest {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("clob")
  resume_text: string;

  @Column("clob")
  job_text: string;

  @Column({ length: 36, nullable: true })
  vector_id: string | null;

  @Column({ type: "varchar2", length: 16, default: "pending" })
  status: GenerateStatus;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at: Date;

  @OneToMany(() => Question, (question) => question.request, { cascade: true })
  questions: Question[];
}

@Entity({ name: "questions" })
@Index("idx_questions_request", ["request"])
@Index("idx_questions_section", ["section"])
export class Question {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => GenerateRequest, (req) => req.questions, {
    onDelete: "CASCADE",
  })
  request: GenerateRequest;

  @Column({ length: 255 })
  text: string;

  @Column({ length: 16 })
  section: string;

  @Column({ length: 255 })
  based_on: string;
}

@Entity({ name: "sessions" })
@Index("idx_sessions_user_status", ["user_id", "status"])
@Index("idx_sessions_created", ["created_at"])
export class InterviewSession {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  user_id: string;

  @Column({ type: "varchar2", length: 16, default: "not_started" })
  status: SessionStatus;

  @ManyToOne(() => GenerateRequest, { nullable: true, onDelete: "SET NULL" })
  request: GenerateRequest | null;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at: Date;

  @OneToMany(() => SessionQuestion, (sq) => sq.session, { cascade: true })
  session_questions: SessionQuestion[];

  @Column({ type: "varchar2", length: 16, default: "pending" })
  rubric_gen_status: QAStatus;

  @Column({ type: "json", nullable: true })
  rubric_json: object | null;

  @Column("clob", { nullable: true })
  rubric_last_error?: string | null;

  @Column({ type: "varchar2", length: 30, nullable: true })
  role_guess: string | null;
}

@Entity({ name: "session_questions" })
@Index("idx_session_questions_session", ["session"])
@Index("idx_session_questions_question", ["question"])
@Index("idx_session_questions_parent", ["parent"])
@Index("idx_session_questions_order", ["order"])
export class SessionQuestion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => InterviewSession, { onDelete: "CASCADE" })
  session: InterviewSession;

  @ManyToOne(() => Question, { nullable: true, onDelete: "SET NULL" })
  question: Question | null;

  @OneToMany(() => Answer, (a) => a.session_question)
  answers: Answer[];

  @Column({ type: "float" })
  order: number;

  @Column({ type: "varchar2", length: 16, default: "main" })
  type: "main" | "followup";

  @Column("clob", { nullable: true })
  followup_text: string | null;

  @ManyToOne(() => SessionQuestion, { nullable: true, onDelete: "CASCADE" })
  parent: SessionQuestion | null;

  @Column({ type: "varchar2", length: 16, default: "pending" })
  rubric_status: QAStatus;

  @Column({ type: "json", nullable: true })
  rubric_json: object | null;

  @Column("clob", { nullable: true })
  rubric_last_error?: string | null;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at: Date;
}

@Entity({ name: "answers" })
@Index("idx_answers_session_question", ["session_question"], { unique: true })
@Index("idx_answers_status", ["status"])
export class Answer {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => SessionQuestion, { onDelete: "CASCADE" })
  session_question: SessionQuestion;

  @Column({ type: "varchar2", length: 16, default: "waiting" })
  status: AnswerStatus;

  @OneToOne(() => AnswerAnalysis, (a) => a.answer)
  analysis?: Relation<AnswerAnalysis>;

  @Column("clob", { nullable: true })
  text: string | null;

  @Column({ nullable: true, length: 255 })
  audio_path: string | null;

  @Column({ type: "timestamp", nullable: true })
  started_at: Date | null;

  @Column({ type: "timestamp", nullable: true })
  ended_at: Date | null;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at: Date;
}

@Entity({ name: "answer_analyses" })
@Index("idx_answer_analyses_status", ["status"])
export class AnswerAnalysis {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @OneToOne(() => Answer, { onDelete: "CASCADE" })
  @JoinColumn({ name: "answer_id" })
  answer: Answer;

  @Column({ type: "varchar2", length: 16, default: "pending" })
  status: QAStatus;

  @Column({ type: "number", default: 0 })
  progress: number;

  @Column({ type: "varchar", length: 64, nullable: true })
  bull_job_id: string | null;

  @Column("json", { nullable: true })
  feedback_json: object | null;

  @Column("json", { nullable: true })
  stt_json: object | null;

  @Column("json", { nullable: true })
  refined_json: object | null;

  @Column("json", { nullable: true })
  voice_json: object | null;

  @Column("clob", { nullable: true })
  last_error?: string | null;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at: Date;
}
