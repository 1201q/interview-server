import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAI } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ResponseCreateParamsWithTools } from "openai/lib/ResponsesParser";
import { Responses } from "openai/resources/index";
import { ZodType } from "zod";

type ParseOpts = {
  name?: string;
  description?: string;
  strict?: boolean;
  onError?: (err: any, raw: any) => void;
};

@Injectable()
export class ChatgptService {
  private client: OpenAI;
  private readonly logger = new Logger(ChatgptService.name);

  constructor(private config: ConfigService) {
    this.client = new OpenAI({ apiKey: config.get<string>("OPENAI_API_KEY") });
  }

  async callResponse(opts: OpenAI.Responses.ResponseCreateParamsNonStreaming) {
    const model = opts.model ?? "gpt-5-mini";
    const input = opts?.input ?? [
      { role: "user" as const, content: (opts as any)?.instructions ?? "" },
    ];

    try {
      const res = await this.client.responses.create({
        ...opts,
        model,
        input,
        reasoning: opts?.reasoning ?? { effort: "low" },
        tools: opts?.tools,
        tool_choice: opts?.tool_choice,
        parallel_tool_calls: opts?.parallel_tool_calls,
      });

      return { res: res, result: JSON.parse(res.output_text) };
    } catch (error) {
      this.logger.error("Error calling ChatGPT", error);
      throw new InternalServerErrorException("Failed to call ChatGPT");
    }
  }

  async callParsedResponse<T>(
    opts: ResponseCreateParamsWithTools,
    schema: ZodType<T>,
    parseOpts: ParseOpts = {},
  ): Promise<T> {
    const model = opts.model ?? "gpt-5-mini";
    const input = opts?.input ?? [
      { role: "user" as const, content: (opts as any)?.instructions ?? "" },
    ];

    const formatName = parseOpts.name ?? "response_schema";

    let format: any;

    try {
      format = zodTextFormat(schema, formatName);
    } catch (error) {
      this.logger.error("Error generating text format from schema", error);
      if (parseOpts.onError) parseOpts.onError(error, null);
      throw new InternalServerErrorException(
        "zodTextFormat 생성 실패 — 로그 확인",
      );
    }

    const textOption = { format, verbosity: opts.text?.verbosity ?? "low" };

    try {
      const res = await this.client.responses.parse({
        ...opts,
        model,
        input,
        text: textOption,
        tools: opts?.tools,
        tool_choice: opts?.tool_choice,
        parallel_tool_calls: opts?.parallel_tool_calls,
      });

      const parsed = res.output_parsed;

      if (parsed === undefined || parsed === null) {
        const err = new Error(
          "No structured output (output_parsed) from model",
        );
        if (parseOpts.onError) parseOpts.onError(err, res);
        this.logger.error("No structured output from model", res);
        throw new InternalServerErrorException(
          "모델이 구조화된 출력을 제공하지 않았습니다.",
        );
      }

      const validation = schema.safeParse(parsed);

      if (!validation.success) {
        if (parseOpts.onError) parseOpts.onError(validation.error, res);
        this.logger.error(
          "Parsed output failed validation",
          validation.error.format(),
        );
        throw new InternalServerErrorException(
          "모델이 제공한 출력이 예상한 형식과 일치하지 않습니다.",
        );
      }

      console.log(validation);

      console.log(res);

      return validation.data;
    } catch (error) {
      this.logger.error("Error calling ChatGPT", error);
      throw new InternalServerErrorException("Failed to call ChatGPT");
    }
  }

  withFileSearch = (
    vectorStoreIds: string[] | string,
    extras?: Partial<Responses.Tool>,
  ): Responses.Tool[] => {
    const ids = Array.isArray(vectorStoreIds)
      ? vectorStoreIds
      : [vectorStoreIds];
    return [
      {
        type: "file_search",
        vector_store_ids: ids,
        ...(extras ?? {}),
      } as Responses.Tool,
    ];
  };
}
