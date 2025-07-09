import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { FlaskModule } from "src/shared/flask/flask.module";

import { OpenaiService } from "src/shared/openai/openai.service";
import { VectorStoreService } from "src/shared/vector-store/vector-store.service";
import { GenerateRequestService } from "./generate-request.service";
import { GenerateRequestController } from "./generate-request.controller";
import { Question, GenerateRequest } from "../entities/entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([GenerateRequest, Question]),
    AuthModule,
    FlaskModule,
  ],
  providers: [GenerateRequestService, OpenaiService, VectorStoreService],
  controllers: [GenerateRequestController],
})
export class GenerateRequestModule {}
