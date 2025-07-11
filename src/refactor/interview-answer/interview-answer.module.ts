import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { FlaskModule } from "src/shared/flask/flask.module";

import { InterviewAnswerService } from "./interview-answer.service";
import { InterviewAnswerController } from "./interview-answer.controller";
import { Answer } from "../entities/entities";

import { InterviewSessionModule } from "../interview-session/interview-session.module";
import { SessionQuestionModule } from "../session-question/session-question.module";

import { FollwupModule } from "../followup/followup.module";
import { OciUploadModule } from "src/shared/oci-upload/oci-upload.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Answer]),
    AuthModule,
    FlaskModule,
    OciUploadModule,
    SessionQuestionModule,
    InterviewSessionModule,
    FollwupModule,
  ],
  providers: [InterviewAnswerService],
  controllers: [InterviewAnswerController],
})
export class InterviewAnswerModule {}
