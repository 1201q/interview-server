import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { FlaskModule } from "src/shared/flask/flask.module";

import { OpenaiService } from "src/shared/openai/openai.service";
import { VectorStoreService } from "src/shared/vector-store/vector-store.service";
import { QuestionRequestService } from "./question-request.service";
import { QuestionRequestController } from "./question-request.controller";

@Module({
  imports: [TypeOrmModule.forFeature([]), AuthModule, FlaskModule],
  providers: [QuestionRequestService],
  controllers: [QuestionRequestController],
})
export class QuestionRequestModule {}
