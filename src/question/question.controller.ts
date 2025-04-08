import { QuestionService } from "./question.service";
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { createQuestionDto } from "./dtos/crate-question.dto";
import { GetQuestionDto } from "./dtos/get-question.dto";
import { RoleQuestion } from "./entities/question.entity";
import { JwtAuthGuard } from "src/auth/guard/jwt-auh.guard";
import { Request } from "express";
import { AuthService } from "src/auth/auth.service";

@Controller("question")
export class QuestionController {
  constructor(
    private readonly questionService: QuestionService,
    private readonly authService: AuthService,
  ) {}

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

  @Get("test")
  @UseGuards(JwtAuthGuard)
  async test(@Req() req: Request) {
    console.log(req.cookies.accessToken);

    console.log(this.authService.decodeAccessToken(req.cookies.accessToken));
    return "test";
  }
}
