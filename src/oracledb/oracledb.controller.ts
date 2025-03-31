import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { OracledbService } from "./oracledb.service";
import { RoleQuestion } from "./entities/question.entity";
import { createQuestionDto } from "./dto/crate-question.dto";
import { GetQuestionDto } from "./dto/get-question.dto";

@Controller("oracledb")
export class OracledbController {
  constructor(private readonly oracledbService: OracledbService) {}

  @Get()
  async getAllQuestions(
    @Query() query: GetQuestionDto,
  ): Promise<RoleQuestion[]> {
    return this.oracledbService.getQuestionByRole(query.role);
  }

  @Get("count")
  async getQuestionCounts() {
    return this.oracledbService.getQuestionCounts([
      "fe",
      "be",
      "android",
      "ios",
    ]);
  }

  @Post()
  async createNewQuestion(@Body() body: createQuestionDto) {
    return this.oracledbService.createNewQuestion(body);
  }

  @Post("bulk")
  async createNewQuestions(@Body() body: createQuestionDto[]) {
    return this.oracledbService.createNewQuestions(body);
  }
}
