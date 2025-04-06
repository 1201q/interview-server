import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "interview_users" })
export class InterviewUser {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  user_id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: "varchar", length: 10 })
  provider: string;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;
}
