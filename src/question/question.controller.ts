import { QuestionService } from "./question.service";
import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { createQuestionDto } from "./dtos/crate-question.dto";
import { GetQuestionDto } from "./dtos/get-question.dto";
import { RoleQuestion } from "./entities/question.entity";

@Controller("question")
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  @Get()
  async getAllQuestions(
    @Query() query: GetQuestionDto,
  ): Promise<RoleQuestion[]> {
    return this.questionService.getQuestionByRole(query.role);
  }

  @Get("count")
  async getQuestionCounts() {
    return this.questionService.getQuestionCounts([
      "fe",
      "be",
      "android",
      "ios",
    ]);
  }

  @Post()
  async createNewQuestion(@Body() body: createQuestionDto) {
    return this.questionService.createNewQuestion(body);
  }

  @Post("bulk")
  async createNewQuestions(@Body() body: createQuestionDto[]) {
    return this.questionService.createNewQuestions(body);
  }
}
