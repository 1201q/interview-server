import { Module } from "@nestjs/common";
import { InterviewService } from "./interview.service";
import { InterviewController } from "./interview.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { InterviewSession } from "./entities/interview.session.entity";
import { InterviewSessionQuestion } from "./entities/interview.session.question.entity";
import { Question } from "src/question/entities/question.entity";
import { AuthModule } from "src/auth/auth.module";
import { OciUploadModule } from "src/oci-upload/oci-upload.module";
import { FlaskModule } from "src/flask/flask.module";
import { AnalysisController } from "./analysis.controller";
import { AudioController } from "./audio.controller";
import { HttpModule } from "@nestjs/axios";
import { SessionController } from "./session.controller";
import { SessionService } from "./session.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InterviewSession,
      InterviewSessionQuestion,
      Question,
    ]),
    AuthModule,
    OciUploadModule,
    FlaskModule,
    HttpModule,
  ],
  providers: [InterviewService, SessionService],
  controllers: [
    InterviewController,
    AnalysisController,
    AudioController,
    SessionController,
  ],
})
export class InterviewModule {}
