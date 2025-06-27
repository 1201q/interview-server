import { Module } from "@nestjs/common";
import { FlaskModule } from "src/shared/flask/flask.module";
import { OpenaiService } from "./openai.service";

@Module({
  imports: [FlaskModule],
  providers: [OpenaiService],
  controllers: [],
  exports: [OpenaiModule],
})
export class OpenaiModule {}
