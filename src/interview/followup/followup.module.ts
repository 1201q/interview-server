import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";

import { FollowupService } from "./followup.service";
import { SessionQuestion } from "../../common/entities/entities";

import { LangChainService } from "src/interview/followup/langchain.service";
import { VectorStoreService } from "src/external-server/vector-store.service";

@Module({
  imports: [TypeOrmModule.forFeature([SessionQuestion]), AuthModule],
  providers: [FollowupService, VectorStoreService, LangChainService],
  exports: [FollowupService],
})
export class FollwupModule {}
