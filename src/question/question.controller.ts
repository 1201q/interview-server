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

import { JwtAuthGuard } from "src/auth/guard/jwt-auh.guard";
import { Request } from "express";
import { AuthService } from "src/auth/auth.service";
import { CreateUserQuestionArrayDto } from "./dtos/create-user-question.dto";
import { Question } from "./entities/question.entity";
import { GenerateQuestionFromGptDto } from "./dtos/generate-question.dto";
import { OpenaiService } from "./openai.service";
import { CreateAiQuestionArrayDto } from "./dtos/create-ai-question.dto";

@Controller("question")
export class QuestionController {
  constructor(
    private readonly questionService: QuestionService,
    private readonly authService: AuthService,
    private readonly openaiService: OpenaiService,
  ) {}

  @Get()
  async getAllQuestions(@Query() query: GetQuestionDto): Promise<Question[]> {
    return this.questionService.getAdminCreatedQuestionsByRole(query.role);
  }

  @Get("user")
  async getUserQuestions(@Req() req: Request): Promise<Question[]> {
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    return this.questionService.getUserCreatedQuestionsByUserId(userId);
  }

  @Get("ai")
  async getAiQuestions(@Req() req: Request): Promise<Question[]> {
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    return this.questionService.getAiGeneratedQuestionsByUserId(userId);
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
    return this.questionService.createNewAdminQuestion(body);
  }

  @Post("bulk")
  async createNewQuestions(@Body() body: CreateQuestionArrayDto) {
    const { items } = body;
    return this.questionService.createNewAdminQuestions(items);
  }

  @Get("test")
  @UseGuards(JwtAuthGuard)
  async test(@Req() req: Request) {
    console.log(req.cookies.accessToken);

    console.log(this.authService.decodeAccessToken(req.cookies.accessToken));
    return "test";
  }

  @Post("add/user")
  async addUserCreatedQuestions(
    @Req() req: Request,
    @Body() body: CreateUserQuestionArrayDto,
  ) {
    const { items } = body;
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    return this.questionService.createNewUserQuestions(items, userId);
  }

  @Post("add/ai")
  async addAiGeneratedQuestions(
    @Req() req: Request,
    @Body() body: CreateAiQuestionArrayDto,
  ) {
    const { items } = body;
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    return this.questionService.createAiQuestions(items, userId);
  }

  @Post("delete/user")
  async deleteUserCreatedQuestions(
    @Req() req: Request,
    @Body() body: { items: string[] },
  ) {
    const { items } = body;
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    return this.questionService.deleteUserCreatedQuestions(items, userId);
  }

  @Get("bookmark")
  async getBookmarkedQuestions(@Req() req: Request) {
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    return this.questionService.getBookmarkedQuestions(userId);
  }

  @Post("bookmark/add")
  async addBookmark(@Req() req: Request, @Body() body: { questionId: string }) {
    const { questionId } = body;
    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;

    return this.questionService.addBookmark(userId, questionId);
  }

  @Post("bookmark/delete")
  async deleteBookmark(
    @Req() req: Request,
    @Body() body: { questionId: string },
  ) {
    const { questionId } = body;

    const token = req.cookies.accessToken as string;
    const userId = (await this.authService.decodeAccessToken(token)).id;
    return this.questionService.deleteBookmark(userId, questionId);
  }

  @Post("ai/generate")
  async generateQuestionFromGpt(@Body() body: GenerateQuestionFromGptDto) {
    const questions = await this.openaiService.generateInterviewQuestions(body);

    return { questions: questions };
  }

  @Post("/feedback/test")
  async feedbackTest(@Body() body: { question_text: string }) {
    const standard = await this.openaiService.generateFeedback(
      body.question_text,
    );

    return { standard: standard };
  }

  @Post("/feedback/array")
  async feedbackArray(
    @Body()
    body: {
      questions: { question_text: string; question_id: string }[];
    },
  ) {
    const standard = await this.openaiService.generateFeedbackStandard(
      body.questions,
    );

    console.log(standard);

    // return { standard: standard };

    return { standard: standard };
  }
}
