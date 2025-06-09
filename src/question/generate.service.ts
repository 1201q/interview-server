import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { GeneratedQuestion } from "./entities/generated.question.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OpenaiService } from "./openai.service";
import { GeneratedQuestionFromResumeResult } from "src/common/interfaces/common.interface";
import { GeneratedQuestionItem } from "./entities/generated.question.items.entity";

@Injectable()
export class GenerationService {
  constructor(
    private readonly openaiService: OpenaiService,

    @InjectRepository(GeneratedQuestion)
    private generatedQuestionRepository: Repository<GeneratedQuestion>,

    @InjectRepository(GeneratedQuestionItem)
    private generatedQuestionItemRepository: Repository<GeneratedQuestionItem>,
  ) {}

  // 이력서
  async createGenerationFromResume(question: Partial<GeneratedQuestion>) {
    try {
      const newQuestion = new GeneratedQuestion();
      newQuestion.resume_text = question.resume_text;
      newQuestion.recruitment_text = question.recruitment_text;

      await this.generatedQuestionRepository.save(newQuestion);

      return newQuestion;
    } catch (error) {
      throw new Error(`Failed to create a new question: ${error.message}`);
    }
  }

  async createGenerationRequest(question: Partial<GeneratedQuestion>) {
    const data = await this.createGenerationFromResume(question);

    data.status = "working";
    await this.generatedQuestionRepository.save(data);

    try {
      const response = await this.openaiService.generateQuestionsFromResume(
        data.resume_text,
        data.recruitment_text,
      );

      const items = response.questions.map((q) => {
        const item = this.generatedQuestionItemRepository.create({
          question: q.question,
          based_on: q.based_on,
          section: q.section,
          generated_question: data,
        });
        return item;
      });

      await this.generatedQuestionItemRepository.save(items);

      data.status = "completed";
      await this.generatedQuestionRepository.save(data);

      return { id: data.id, status: data.status };
    } catch (error) {
      data.status = "failed";
      await this.generatedQuestionRepository.save(data);
      throw error;
    }
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
