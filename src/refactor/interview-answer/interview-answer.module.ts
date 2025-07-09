import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { FlaskModule } from "src/shared/flask/flask.module";

import { InterviewAnswerService } from "./interview-answer.service";
import { InterviewAnswerController } from "./interview-answer.controller";
import { Answer, Question, SessionQuestion } from "../entities/entities";

import { InterviewSessionModule } from "../interview-session/interview-session.module";
import { SessionQuestionModule } from "../session-question/session-question.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Answer]),
    AuthModule,
    FlaskModule,
    SessionQuestionModule,
    InterviewSessionModule,
  ],
  providers: [InterviewAnswerService],
  controllers: [InterviewAnswerController],
})
export class InterviewAnswerModule {}
