import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { QuestionGenerationRequest } from "./question.generation.request";

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

  @ManyToOne(() => QuestionGenerationRequest, (q) => q.items, {
    onDelete: "CASCADE",
  })
  request: QuestionGenerationRequest;
}
