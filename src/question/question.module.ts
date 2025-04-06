import { Module } from "@nestjs/common";
import { RoleQuestion } from "./entities/question.entity";
import { QuestionService } from "./question.service";
import { QuestionController } from "./question.controller";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  imports: [TypeOrmModule.forFeature([RoleQuestion])],
  providers: [QuestionService],
  controllers: [QuestionController],
})
export class QuestionModule {}
