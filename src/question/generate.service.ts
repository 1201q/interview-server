import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { GeneratedQuestion } from "./entities/generated.question.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OpenaiService } from "./openai.service";
import { GenerateQuestionFromResumeResult } from "src/common/interfaces/common.interface";

@Injectable()
export class GenerationService {
  constructor(
    private readonly openaiService: OpenaiService,

    @InjectRepository(GeneratedQuestion)
    private generatedQuestionRepository: Repository<GeneratedQuestion>,
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

      data.result_json = JSON.stringify(response);
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
      where: {
        id: id,
      },
      select: ["result_json"],
    });

    const parsed: { questions: GenerateQuestionFromResumeResult } = JSON.parse(
      result.result_json,
    );

    console.log(parsed);

    return parsed;
  }
}
