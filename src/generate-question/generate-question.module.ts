import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";

import { VectorStoreService } from "src/external-server/vector-store.service";
import { GenerateQuestionService } from "./generate-question.service";
import { GenerateQuestionController } from "./generate-question.controller";
import { Question, GenerateRequest } from "../common/entities/entities";
import { ExternalServerModule } from "../external-server/external-server.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([GenerateRequest, Question]),
    AuthModule,
    ExternalServerModule,
  ],
  providers: [GenerateQuestionService, VectorStoreService],
  controllers: [GenerateQuestionController],
})
export class GenerateQuestionModule {}
