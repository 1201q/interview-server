import { Module } from "@nestjs/common";
import { InterviewService } from "./interview.service";
import { InterviewController } from "./interview.controller";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuthModule } from "src/auth/auth.module";
import { OciUploadModule } from "src/oci-upload/oci-upload.module";
import { FlaskModule } from "src/shared/flask/flask.module";
import { AnalysisController } from "./analysis.controller";
import { AudioController } from "./audio.controller";
import { HttpModule } from "@nestjs/axios";
import { SessionController } from "./session.controller";
import { SessionService } from "./session.service";
import { AnswerController } from "./answer.controller";
import { AnswerService } from "./answer.service";
import { AnalysisService } from "./analysis.service";

import { NewInterviewSession } from "./entities/new.interview.session.entity";
import { NewInterviewAnswer } from "./entities/new.interview.answer.entity";
import { GeneratedQuestionItem } from "src/question-generator/entities/generated.question.items.entity";
import { QuestionGenerationRequest } from "src/question-generator/entities/question.generation.request";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GeneratedQuestionItem,
      QuestionGenerationRequest,
      NewInterviewSession,
      NewInterviewAnswer,
    ]),
    AuthModule,
    OciUploadModule,
    FlaskModule,
    HttpModule,
  ],
  providers: [InterviewService, SessionService, AnswerService, AnalysisService],
  controllers: [
    InterviewController,
    AnalysisController,
    AudioController,
    SessionController,
    AnswerController,
  ],
})
export class InterviewModule {}
