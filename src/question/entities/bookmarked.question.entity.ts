import { QuestionType } from "src/common/interfaces/common.interface";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "bookmarked_questions" })
export class BookmarkedQuestion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  user_id: string;

  @Column()
  question_id: string;
}
