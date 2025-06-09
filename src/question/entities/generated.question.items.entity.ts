import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { GeneratedQuestion } from "./generated.question.entity";

@Entity({ name: "generated_question_items" })
export class GeneratedQuestionItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  question: string;

  @Column()
  based_on: string;

  @Column()
  section: "basic" | "experience" | "job_related" | "expertise";

  @ManyToOne(() => GeneratedQuestion, (q) => q.items, {
    onDelete: "CASCADE",
  })
  generated_question: GeneratedQuestion;
}
