import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { FlaskModule } from "src/shared/flask/flask.module";

import { FollowupService } from "./followup.service";
import { SessionQuestion } from "../entities/entities";

import { LangChainService } from "src/shared/openai/langchain.service";
import { VectorStoreService } from "src/shared/vector-store/vector-store.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([SessionQuestion]),
    AuthModule,
    FlaskModule,
  ],
  providers: [FollowupService, VectorStoreService, LangChainService],
  controllers: [],
  exports: [FollowupService],
})
export class FollwupModule {}
