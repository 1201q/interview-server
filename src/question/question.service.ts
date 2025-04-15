import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { RoleQuestion } from "./entities/question.entity";

import { v4 as uuidv4 } from "uuid";
import { QuestionType, RoleType } from "../common/interfaces/common.interface";
import { UserQuestion } from "./entities/user.question.entity";
import { BookmarkedQuestion } from "./entities/bookmarked.question.entity";

@Injectable()
export class QuestionService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(RoleQuestion)
    private readonly roleQuestionRepository: Repository<RoleQuestion>,

    @InjectRepository(UserQuestion)
    private readonly userQuestionRepository: Repository<UserQuestion>,
  ) {}

  async findAllQuestions(): Promise<RoleQuestion[]> {
    return this.roleQuestionRepository.find();
  }

  async getQuestionByRole(role: RoleType): Promise<RoleQuestion[]> {
    return this.roleQuestionRepository.find({ where: { role: role } });
  }

  async getQuestionByUserId(userId: string): Promise<UserQuestion[]> {
    const data = await this.userQuestionRepository.find({
      where: { user_id: userId },
    });

    return data;
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

  async createNewUserQuestions(
    questions: Partial<UserQuestion>[],
    user_id: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newQuestions = questions.map((q) => {
        const newQuestion = new UserQuestion();
        newQuestion.question_text = q.question_text;
        newQuestion.role = q.role;
        newQuestion.id = uuidv4();
        newQuestion.user_id = user_id;

        return newQuestion;
      });

      await queryRunner.manager.save(UserQuestion, newQuestions);
      await queryRunner.commitTransaction();
      return newQuestions;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new Error(`Failed to create new questions: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async deleteUserCreatedQuestions(ids: string[], userId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from(UserQuestion)
        .where("id IN (:...ids)", { ids })
        .andWhere("user_id = :userId", { userId })
        .execute();

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new Error(`Failed to delete questions: ${error.message}`);
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

  // 북마크
  async getBookmarkedQuestions(userId: string) {
    return this.dataSource.getRepository(BookmarkedQuestion).find({
      where: { user_id: userId },
    });
  }

  async addBookmark(userId: string, questionId: string) {
    const repo = this.dataSource.getRepository(BookmarkedQuestion);
    const existingBookmark = await repo.findOneBy({
      user_id: userId,
      question_id: questionId,
    });

    if (existingBookmark) throw new Error("Already bookmarked");

    const newBookmark = repo.create({
      user_id: userId,
      question_id: questionId,
    });

    return await repo.save(newBookmark);
  }

  async deleteBookmark(userId: string, questionId: string) {
    const repo = this.dataSource.getRepository(BookmarkedQuestion);

    await repo.delete({
      user_id: userId,
      question_id: questionId,
    });
  }
}
