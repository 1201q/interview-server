import { Module } from "@nestjs/common";
import { FlaskModule } from "src/shared/flask/flask.module";
import { OpenaiService } from "./openai.service";
import { LangChainService } from "./langchain.service";

import { VectorStoreService } from "../vector-store/vector-store.service";
import { OpenaiController } from "./openai.controller";

@Module({
  imports: [FlaskModule],
  providers: [OpenaiService, LangChainService, VectorStoreService],
  controllers: [OpenaiController],
  exports: [OpenaiModule],
})
export class OpenaiModule {}
