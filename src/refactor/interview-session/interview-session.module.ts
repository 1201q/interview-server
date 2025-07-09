import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { FlaskModule } from "src/shared/flask/flask.module";

import { InterviewSessionService } from "./interview-session.service";
import { InterviewSessionController } from "./interview-session.controller";
import {
  Answer,
  AnswerAnalysis,
  InterviewSession,
  SessionQuestion,
} from "../entities/entities";
import { SessionQuestionService } from "../session-question/session-question.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InterviewSession,
      SessionQuestion,
      Answer,
      AnswerAnalysis,
    ]),
    AuthModule,
    FlaskModule,
  ],
  providers: [InterviewSessionService, SessionQuestionService],
  controllers: [InterviewSessionController],
  exports: [InterviewSessionService],
})
export class InterviewSessionModule {}
