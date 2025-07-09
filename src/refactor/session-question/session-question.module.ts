import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { FlaskModule } from "src/shared/flask/flask.module";

import { SessionQuestionService } from "./session-question.service";

import { InterviewSession, SessionQuestion } from "../entities/entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([InterviewSession, SessionQuestion]),
    AuthModule,
    FlaskModule,
  ],
  providers: [SessionQuestionService],
  exports: [SessionQuestionService],
})
export class SessionQuestionModule {}
