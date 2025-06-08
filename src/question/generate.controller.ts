import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { GenerateQuestionFromResumeDto } from "./dtos/generate-question.dto";
import { GenerationService } from "./generate.service";

@Controller("question/generate")
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post("new")
  async createQuestion(@Body() body: GenerateQuestionFromResumeDto) {
    const { resume_text, recruitment_text } = body;

    const result = await this.generationService.createGenerationRequest({
      resume_text,
      recruitment_text,
    });

    return { id: result.id, status: result.status };
  }

  @Get("/:id")
  async getGeneratedQuestions(@Param("id") id: string) {
    const data = await this.generationService.getGeneratedQuestions(id);

    return data;
  }
}
