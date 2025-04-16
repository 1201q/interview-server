import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";
import { RoleType } from "../../common/interfaces/common.interface";

@Entity({ name: "role_questions" })
export class RoleQuestion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  question_text: string;

  @Column({ type: "varchar", length: 10 })
  role: RoleType;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;
}
