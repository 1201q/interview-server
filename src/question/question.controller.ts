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
import {
  CreateQuestionArrayDto,
  CreateQuestionDto,
} from "./dtos/crate-question.dto";
import { GetQuestionDto } from "./dtos/get-question.dto";
import { RoleQuestion } from "./entities/question.entity";
import { JwtAuthGuard } from "src/auth/guard/jwt-auh.guard";
import { Request } from "express";
import { AuthService } from "src/auth/auth.service";
import { CreateUserQuestionArrayDto } from "./dtos/create-user-question.dto";
import { GetUserQuestionDto } from "./dtos/get-user-question.dto";
import { UserQuestion } from "./entities/user.question.entity";

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

  @Get("user")
  async getUserQuestions(@Req() req: Request): Promise<UserQuestion[]> {
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    return this.questionService.getQuestionByUserId(userId);
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
  async createNewQuestion(@Body() body: CreateQuestionDto) {
    return this.questionService.createNewQuestion(body);
  }

  @Post("bulk")
  async createNewQuestions(@Body() body: CreateQuestionArrayDto) {
    const { items } = body;
    return this.questionService.createNewQuestions(items);
  }

  @Get("test")
  @UseGuards(JwtAuthGuard)
  async test(@Req() req: Request) {
    console.log(req.cookies.accessToken);

    console.log(this.authService.decodeAccessToken(req.cookies.accessToken));
    return "test";
  }

  @Post("add/user")
  async addUser(@Req() req: Request, @Body() body: CreateUserQuestionArrayDto) {
    const { items } = body;
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    return this.questionService.createNewUserQuestions(items, userId);
  }
}
