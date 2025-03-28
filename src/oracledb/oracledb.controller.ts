import { Body, Controller, Get, Post } from "@nestjs/common";
import { OracledbService } from "./oracledb.service";
import { RoleQuestion } from "./entities/question.entity";
import { createQuestionDto } from "./dto/crate-question.dto";

@Controller("oracledb")
export class OracledbController {
  constructor(private readonly oracledbService: OracledbService) {}

  @Get()
  async getAllQuestions(): Promise<RoleQuestion[]> {
    return this.oracledbService.findAll();
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
