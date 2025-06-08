import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import { v4 as uuidv4 } from "uuid";
import {
  GenerateQuestionFromResumeResult,
  RoleType,
} from "../common/interfaces/common.interface";

import { BookmarkedQuestion } from "./entities/bookmarked.question.entity";
import { Question } from "./entities/question.entity";
import { GeneratedQuestion } from "./entities/generated.question.entity";

@Injectable()
export class QuestionService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,

    @InjectRepository(GeneratedQuestion)
    private readonly generatedQuestionRepository: Repository<GeneratedQuestion>,
  ) {}

  async getAdminCreatedQuestionsByRole(role: RoleType): Promise<Question[]> {
    if (role) {
      return this.questionRepository.find({ where: { role: role } });
    }

    return this.questionRepository.find({ where: { creator_type: "admin" } });
  }

  async getUserCreatedQuestionsByUserId(userId: string): Promise<Question[]> {
    const data = await this.questionRepository.find({
      where: { user_id: userId, role: "user" },
    });

    return data;
  }

  async getAiGeneratedQuestionsByUserId(userId: string): Promise<Question[]> {
    const data = await this.questionRepository.find({
      where: { user_id: userId, role: "ai" },
    });

    return data;
  }

  async createNewAdminQuestion(question: Partial<Question>) {
    try {
      const newQuestion = new Question();
      newQuestion.question_text = question.question_text;
      newQuestion.role = question.role;
      newQuestion.user_id = null;
      newQuestion.creator_type = "admin";

      await this.questionRepository.save(newQuestion);
      return newQuestion;
    } catch (error) {
      throw new Error(`Failed to create a new question: ${error.message}`);
    }
  }

  async createNewAdminQuestions(questions: Partial<Question>[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newQuestions = questions.map((q) => {
        const newQuestion = new Question();
        newQuestion.question_text = q.question_text;
        newQuestion.role = q.role;
        newQuestion.user_id = null;
        newQuestion.creator_type = "admin";

        return newQuestion;
      });

      await queryRunner.manager.save(Question, newQuestions);
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
    questions: Partial<Question>[],
    user_id: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newQuestions = questions.map((q) => {
        const newQuestion = new Question();
        newQuestion.question_text = q.question_text;
        newQuestion.role = "user";
        newQuestion.creator_type = "user";
        newQuestion.id = uuidv4();
        newQuestion.user_id = user_id;

        return newQuestion;
      });

      await queryRunner.manager.save(Question, newQuestions);
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
      // 질문 삭제
      await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from(Question)
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
    const result = await this.questionRepository
      .createQueryBuilder("questions")
      .select("questions.role", "role")
      .addSelect("COUNT(*)", "count")
      .where("questions.role IN (:...roles)", { roles })
      .groupBy("questions.role")
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
    const data = await this.dataSource.getRepository(BookmarkedQuestion).find({
      where: { user_id: userId },
      relations: ["question"],
    });

    return data;
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

  // ai

  async createAiQuestions(questions: Partial<Question>[], user_id: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newQuestions = questions.map((q) => {
        const newQuestion = new Question();
        newQuestion.question_text = q.question_text;
        newQuestion.role = "ai";
        newQuestion.creator_type = "user";
        newQuestion.id = uuidv4();
        newQuestion.user_id = user_id;

        return newQuestion;
      });

      await queryRunner.manager.save(Question, newQuestions);
      await queryRunner.commitTransaction();
      return newQuestions;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new Error(`Failed to create new questions: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }
}
