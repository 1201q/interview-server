import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { SessionQuestionService } from "./session-question.service";

import {
  Answer,
  InterviewSession,
  SessionQuestion,
} from "../entities/entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([InterviewSession, SessionQuestion, Answer]),
  ],
  providers: [SessionQuestionService],
  exports: [SessionQuestionService],
})
export class SessionQuestionModule {}
