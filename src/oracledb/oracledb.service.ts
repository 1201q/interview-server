import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { RoleQuestion } from "./entities/question.entity";
import { v4 as uuidv4 } from "uuid";
import { RoleType } from "./types/type";

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

  async getQuestionByRole(role: RoleType): Promise<RoleQuestion[]> {
    return this.roleQuestionRepository.find({ where: { role: role } });
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

  async createNewQuestions(questions: Partial<RoleQuestion>[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newQuestions = questions.map((q) => {
        const newQuestion = new RoleQuestion();
        newQuestion.question_text = q.question_text;
        newQuestion.role = q.role;
        newQuestion.id = uuidv4();

        return newQuestion;
      });

      await queryRunner.manager.save(RoleQuestion, newQuestions);
      await queryRunner.commitTransaction();
      return newQuestions;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new Error(`Failed to create new questions: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async getQuestionCounts(roles: RoleType[]) {
    const result = await this.roleQuestionRepository
      .createQueryBuilder("role_questions")
      .select("role_questions.role", "role")
      .addSelect("COUNT(*)", "count")
      .where("role_questions.role IN (:...roles)", { roles })
      .groupBy("role_questions.role")
      .getRawMany();

    const counts: Record<string, number> = {};

    roles.forEach((role) => {
      counts[role] = 0;
    });

    result.forEach((row) => {
      counts[row.role] = Number(row.count);
    });

    return counts;
  }
}
