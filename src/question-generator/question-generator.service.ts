import { Injectable, NotFoundException } from "@nestjs/common";

import { QuestionGenerationRequest } from "./entities/question.generation.request";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import { GeneratedQuestionItem } from "./entities/generated.question.items.entity";
import { OpenaiService } from "src/shared/openai/openai.service";
import { VectorStoreService } from "src/shared/vector-store/vector-store.service";

@Injectable()
export class QuestionGeneratorService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly openaiService: OpenaiService,

    private readonly vectorStoreService: VectorStoreService,

    @InjectRepository(QuestionGenerationRequest)
    private generatedQuestionRepository: Repository<QuestionGenerationRequest>,

    @InjectRepository(GeneratedQuestionItem)
    private generatedQuestionItemRepository: Repository<GeneratedQuestionItem>,
  ) {}

  // 이력서
  async createGenerationFromResume(
    question: Partial<QuestionGenerationRequest>,
  ) {
    try {
      const newQuestion = new QuestionGenerationRequest();
      newQuestion.resume_text = question.resume_text;
      newQuestion.recruitment_text = question.recruitment_text;

      await this.generatedQuestionRepository.save(newQuestion);

      return newQuestion;
    } catch (error) {
      throw new Error(`Failed to create a new question: ${error.message}`);
    }
  }

  async createGenerationRequest(question: Partial<QuestionGenerationRequest>) {
    return await this.dataSource.transaction(async (manager) => {
      const newQuestion = manager.create(QuestionGenerationRequest, {
        resume_text: question.resume_text,
        recruitment_text: question.recruitment_text,
        status: "working",
      });

      await manager.save(newQuestion);

      try {
        await this.vectorStoreService.save(
          question.resume_text!,
          question.recruitment_text!,
          newQuestion.id,
        );

        const response = await this.openaiService.questionGenerator(
          question.resume_text!,
          question.recruitment_text!,
        );

        const items = response.questions.map((q) => {
          const item = this.generatedQuestionItemRepository.create({
            question: q.question,
            based_on: q.based_on,
            section: q.section,
            request: newQuestion,
          });
          return item;
        });

        await manager.save(items);
        newQuestion.status = "completed";
        newQuestion.vector_id = newQuestion.id;
        await manager.save(newQuestion);

        return { id: newQuestion.id, status: "completed" };
      } catch (error) {
        newQuestion.status = "failed";
        await manager.save(newQuestion);

        try {
          await this.vectorStoreService.deleteByRequestId(newQuestion.id);
        } catch (error) {
          console.warn(error);
        }

        throw error;
      }
    });
  }

  async getGeneratedQuestions(id: string) {
    const result = await this.generatedQuestionRepository.findOne({
      where: { id },
      relations: ["items"],
    });

    if (!result) {
      throw new NotFoundException("해당 ID의 생성 요청이 존재하지 않습니다.");
    }

    const questions = result.items.map((item) => ({
      id: item.id,
      question: item.question,
      based_on: item.based_on,
      section: item.section,
    }));

    return { questions };
  }
}
