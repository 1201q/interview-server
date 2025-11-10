import { QuestionItem } from "@/common/interfaces/common.interface";
import { QuestionGeneratorPromptV5_1_1 } from "@/common/prompts/question-generator.prompt";
import { makeQuestionSchema } from "@/common/schemas/prompt.schema";
import { OpenAIService } from "@/openai-service/openai.service";
import { Injectable } from "@nestjs/common";
import { zodTextFormat } from "openai/helpers/zod";
import { PassThrough } from "stream";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/Pick";
import { streamArray } from "stream-json/streamers/StreamArray";

@Injectable()
export class QuestionGenerationPipeline {
  constructor(private readonly ai: OpenAIService) {}

  // 질문 생성 스트림 생성
  createStream(
    resumeText: string,
    jobText: string,
    limits: Record<string, number>,
  ) {
    const limitCount = Object.values(limits).reduce((sum, v) => sum + v, 0);
    const prompt = QuestionGeneratorPromptV5_1_1(resumeText, jobText, limits);
    const schema = makeQuestionSchema(limitCount);

    const format = zodTextFormat(schema, "generated_questions");

    const stream = this.ai.streamParsed({
      opts: {
        model: "gpt-5-mini",
        input: [
          {
            role: "system",
            content:
              "당신은 어떤 직군이든 면접 질문을 만들어낼 수 있는 전문 면접관입니다.",
          },
          { role: "user", content: prompt },
        ],
        reasoning: { effort: "low" },
        stream: true,
        text: { format: format },
      },
      schema,
      parseOpts: { name: "generated_questions" },
    });

    const pt = new PassThrough({ encoding: "utf8" });
    const pipeline = chain([
      pt,
      parser(),
      pick({ filter: "questions" }),
      streamArray(),
    ]);

    stream.on("response.output_text.delta", (e: any) => pt.write(e.delta));
    stream.on("response.completed", () => pt.end());
    stream.on("error", () => {
      pt.destroy(new Error("openai_stream_error"));
    });

    return { stream, pipeline, pt, limitCount };
  }

  async getFinalQuestions(stream: any): Promise<QuestionItem[]> {
    try {
      const result = await stream.finalResponse();
      return result.output_parsed.questions;
    } catch (e: any) {
      // 사용자가 abort한 경우: 그냥 빈 배열 반환
      // 지우면 안됨
      if (e?.name === "APIUserAbortError") {
        return [];
      }
      throw e;
    }
  }
}
