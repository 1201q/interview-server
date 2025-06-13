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
import { AnswerController } from "./answer.controller";
import { AnswerService } from "./answer.service";
import { AnalysisService } from "./analysis.service";
import { SseService } from "./sse.service";
import { NewInterviewSession } from "./entities/new.interview.session.entity";
import { NewInterviewAnswer } from "./entities/new.interview.answer.entity";
import { GeneratedQuestionItem } from "src/question/entities/generated.question.items.entity";
import { QuestionGenerationRequest } from "src/question/entities/question.generation.request";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InterviewSession,
      InterviewSessionQuestion,
      Question,
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
  providers: [
    InterviewService,
    SessionService,
    AnswerService,
    AnalysisService,
    SseService,
  ],
  controllers: [
    InterviewController,
    AnalysisController,
    AudioController,
    SessionController,
    AnswerController,
  ],
})
export class InterviewModule {}
