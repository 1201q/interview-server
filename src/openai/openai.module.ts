import { Module } from "@nestjs/common";
import { ChatgptService } from "./chatgpt.service";
import { WhisperService } from "./whisper.service";
import { EmbeddingService } from "./embedding.service";
import { OpenAIService } from "./openai.service";

@Module({
  providers: [ChatgptService, WhisperService, EmbeddingService, OpenAIService],
  exports: [OpenAIService],
})
export class OpenaiModule {}
