import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";

import { InterviewAnswerService } from "./answer.service";
import { InterviewAnswerController } from "./answer.controller";
import { Answer } from "../../common/entities/entities";

import { InterviewSessionModule } from "../session/session.module";
import { SessionQuestionModule } from "../question/question.module";

import { FollwupModule } from "../followup/followup.module";

import { ExternalServerModule } from "../../external-server/external-server.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Answer]),
    AuthModule,

    SessionQuestionModule,
    InterviewSessionModule,
    FollwupModule,
    ExternalServerModule,
  ],
  providers: [InterviewAnswerService],
  controllers: [InterviewAnswerController],
})
export class InterviewAnswerModule {}
