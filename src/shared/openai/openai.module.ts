import { Module } from "@nestjs/common";
import { FlaskModule } from "src/shared/flask/flask.module";
import { OpenaiService } from "./openai.service";
import { LangChainService } from "./langchain.service";

@Module({
  imports: [FlaskModule],
  providers: [OpenaiService, LangChainService],
  controllers: [],
  exports: [OpenaiModule],
})
export class OpenaiModule {}
