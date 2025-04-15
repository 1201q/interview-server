import { Module } from "@nestjs/common";
import { RoleQuestion } from "./entities/question.entity";
import { QuestionService } from "./question.service";
import { QuestionController } from "./question.controller";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuthModule } from "src/auth/auth.module";
import { UserQuestion } from "./entities/user.question.entity";
import { BookmarkedQuestion } from "./entities/bookmarked.question.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([RoleQuestion, UserQuestion, BookmarkedQuestion]),
    AuthModule,
  ],
  providers: [QuestionService],
  controllers: [QuestionController],
})
export class QuestionModule {}
