import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";

import { InterviewSessionService } from "./session.service";
import { InterviewSessionController } from "./session.controller";
import {
  Answer,
  AnswerAnalysis,
  InterviewSession,
  SessionQuestion,
} from "../../common/entities/entities";
import { SessionQuestionService } from "../question/question.service";
import { ExternalServerModule } from "../../external-server/external-server.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InterviewSession,
      SessionQuestion,
      Answer,
      AnswerAnalysis,
    ]),
    AuthModule,
    ExternalServerModule,
  ],
  providers: [InterviewSessionService, SessionQuestionService],
  controllers: [InterviewSessionController],
  exports: [InterviewSessionService],
})
export class InterviewSessionModule {}
