import { Injectable } from "@nestjs/common";
import { ZodType } from "zod";
import { ChatgptService } from "./chatgpt.service";
import { EmbeddingService } from "./embedding.service";
import { WhisperService } from "./whisper.service";
import { Responses } from "openai/resources/index";

type ChatOpts = Parameters<ChatgptService["callResponse"]>[0];
type ParsedChatOpts<T> = {
  opts: Parameters<ChatgptService["callParsedResponse"]>[0];
  schema: ZodType<T>;
  parseOpts?: Parameters<ChatgptService["callParsedResponse"]>[2];
};

@Injectable()
export class OpenAIService {
  constructor(
    private readonly chatgpt: ChatgptService,
    private readonly embed: EmbeddingService,
    private readonly whisper: WhisperService,
  ) {}

  // ---------- Chat (비구조화) ----------
  async chat(opts: ChatOpts) {
    return this.chatgpt.callResponse(opts);
  }

  // ---------- Chat (구조화 / Zod) ----------
  async chatParsed<T>({
    opts,
    schema,
    parseOpts,
  }: ParsedChatOpts<T>): Promise<T> {
    return this.chatgpt.callParsedResponse<T>(opts, schema, parseOpts);
  }

  // ---------- STT ----------
  async transcribe(file: Express.Multer.File) {
    return this.whisper.transcribe(file);
  }

  // ---------- 임베딩/벡터 스토어 ----------
  async saveToVectorStore(input: {
    resumeText: string;
    jobText: string;
    requestId: string;
  }) {
    return this.embed.save(input);
  }

  // ---------- Responses file_search 툴 헬퍼 ----------
  withFileSearch(
    vectorStoreIds: string[] | string,
    extras?: Partial<Responses.Tool>,
  ) {
    return this.chatgpt.withFileSearch(vectorStoreIds, extras);
  }
}
