import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "generate_requests" })
export class GenerateRequest {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("clob")
  resume_text: string;

  @Column("clob")
  job_text: string;

  @Column({ length: 36, nullable: true })
  vector_id: string;

  @Column({ default: "pending" })
  status: "pending" | "working" | "completed" | "failed";

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Question, (question) => question.request, {
    cascade: true,
  })
  questions: Question[];
}

@Entity({ name: "questions" })
export class Question {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => GenerateRequest, (req) => req.questions, {
    onDelete: "CASCADE",
  })
  request: GenerateRequest;

  @Column({ length: 500 })
  text: string;

  @Column()
  section: string;

  @Column()
  based_on: string;
}

@Entity({ name: "sessions" })
export class InterviewSession {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  user_id: string;

  @Column({ default: "not_started" })
  status: "not_started" | "in_progress" | "completed" | "expired";

  @ManyToOne(() => GenerateRequest, { nullable: true, onDelete: "SET NULL" })
  request: GenerateRequest;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => SessionQuestion, (sq) => sq.session, {
    cascade: true,
  })
  session_questions: SessionQuestion[];

  @Column({ default: "pending" })
  rubric_gen_status: "pending" | "processing" | "completed" | "failed";

  @Column({ type: "json", nullable: true })
  rubric_json: object;

  @Column("clob", { nullable: true })
  rubric_last_error?: string | null;
}

@Entity({ name: "session_questions" })
export class SessionQuestion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => InterviewSession, (sess) => sess.session_questions, {
    onDelete: "CASCADE",
  })
  session: InterviewSession;

  @ManyToOne(() => Question, { nullable: true })
  question: Question;

  @Column({ type: "float" })
  order: number;

  @Column({ default: "main" })
  type: "main" | "followup";

  @Column("clob", { nullable: true })
  followup_text: string;

  @ManyToOne(() => SessionQuestion, { nullable: true })
  parent: SessionQuestion;

  @OneToMany(() => Answer, (ans) => ans.session_question, {
    cascade: true,
  })
  answers: Answer[];

  @Column({ default: "pending" })
  rubric_status: "pending" | "processing" | "completed" | "failed";

  @Column({ type: "json", nullable: true })
  rubric_json: object;

  @Column("clob", { nullable: true })
  rubric_last_error?: string | null;
}

@Entity({ name: "answers" })
export class Answer {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => SessionQuestion, (sq) => sq.answers, { onDelete: "CASCADE" })
  session_question: SessionQuestion;

  @Column({ default: "waiting" })
  status: "waiting" | "ready" | "answering" | "submitted";

  @Column("clob", { nullable: true })
  text: string;

  @Column({ nullable: true })
  audio_path: string;

  @Column({ type: "timestamp", nullable: true })
  started_at: Date;

  @Column({ type: "timestamp", nullable: true })
  ended_at: Date;

  @OneToMany(() => AnswerAnalysis, (ana) => ana.answer, {
    cascade: true,
  })
  analyses: AnswerAnalysis[];
}

@Entity({ name: "answer_analyses" })
export class AnswerAnalysis {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Answer, { onDelete: "CASCADE", eager: true })
  answer: Answer;

  @Column({ default: "pending" })
  status: "pending" | "processing" | "completed" | "failed";

  @Column("json", { nullable: true })
  feedback_json: object;

  @Column("json", { nullable: true })
  stt_json: object;

  @Column("json", { nullable: true })
  refined_words_json: object;

  @Column("json", { nullable: true })
  voice_json: object;

  @Column("clob", { nullable: true })
  last_error?: string | null;

  @CreateDateColumn()
  created_at: Date;
}
