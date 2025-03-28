import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { RoleQuestion } from "./entities/question.entity";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class OracledbService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(RoleQuestion)
    private readonly roleQuestionRepository: Repository<RoleQuestion>,
  ) {}

  async findAll(): Promise<RoleQuestion[]> {
    return this.roleQuestionRepository.find();
  }

  async createNewQuestion(question: Partial<RoleQuestion>) {
    try {
      const newQuestion = new RoleQuestion();
      newQuestion.question_text = question.question_text;
      newQuestion.role = question.role;
      newQuestion.id = uuidv4();

      await this.roleQuestionRepository.save(newQuestion);
      return newQuestion;
    } catch (error) {
      throw new Error(`Failed to create a new question: ${error.message}`);
    }
  }
}
