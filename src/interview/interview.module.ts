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
  ],
  providers: [InterviewService],
  controllers: [InterviewController, AnalysisController],
})
export class InterviewModule {}
