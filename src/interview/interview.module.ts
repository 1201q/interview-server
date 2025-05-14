import { Module } from "@nestjs/common";
import { InterviewService } from "./interview.service";
import { InterviewController } from "./interview.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { InterviewSession } from "./entities/interview.session.entity";
import { InterviewSessionQuestion } from "./entities/interview.session.question.entity";
import { Question } from "src/question/entities/question.entity";
import { AuthService } from "src/auth/auth.service";
import { AuthModule } from "src/auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InterviewSession,
      InterviewSessionQuestion,
      Question,
    ]),
    AuthModule,
  ],
  providers: [InterviewService],
  controllers: [InterviewController],
})
export class InterviewModule {}
