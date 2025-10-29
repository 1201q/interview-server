import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { DataSource, Repository } from "typeorm";
import { Question, GenerateRequest } from "../common/entities/entities";
import {
  CreateQuestionRequestDto,
  GenerateResponseDto,
  GQRequestResponseDto,
  InsertQuestionsBodyDto,
} from "./generate-question.dto";
import OpenAI from "openai";
import { ConfigService } from "@nestjs/config";
import {
  QuestionGeneratorPrompt,
  QuestionGeneratorPromptV5_1_1,
} from "src/common/prompts/question-generator.prompt";
import { Response } from "express";
import {
  makeQuestionSchema,
  QuestionItem,
} from "src/common/schemas/prompt.schema";
import { MOCK_QUESTIONS } from "src/common/constants/mock-question";

import { PassThrough } from "stream";

import { chain } from "stream-chain";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/Pick";
import { streamArray } from "stream-json/streamers/StreamArray";
import { zodTextFormat } from "openai/helpers/zod";

import { OpenAIService } from "@/llm/openai.service";

type WriteEventOpts = {
  id?: string | number;
  event?: string;
  data?: any;

  retryMs?: number;
};

@Injectable()
export class GenerateQuestionService {
  private openai: OpenAI;
  private readonly logger = new Logger(GenerateQuestionService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly ai: OpenAIService,

    @InjectRepository(GenerateRequest)
    private readonly requestRepo: Repository<GenerateRequest>,

    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get("OPENAI_API_KEY"),
    });
  }

  async createQuestionRequest(
    dto: CreateQuestionRequestDto,
  ): Promise<GenerateResponseDto> {
    const resultDto: GenerateResponseDto = {
      request_id: null,
      status: "failed",
    };

    await this.dataSource.transaction(async (manager) => {
      const request = manager.create(GenerateRequest, {
        resume_text: dto.resume_text,
        job_text: dto.job_text,
        status: "working",
      });

      await manager.save(request);

      resultDto.request_id = request.id;

      try {
        this.logger.log(`vector store에 업로드 중... ${request.id}`);

        const vectorResult = await this.ai.saveToVectorStore({
          resumeText: dto.resume_text,
          jobText: dto.job_text,
          requestId: request.id,
        });

        console.log(vectorResult);

        const response = await this.questionGenerator(
          dto.resume_text,
          dto.job_text,
        );

        const questionRepo = manager.getRepository(Question);

        const questions = response.questions.map((q) =>
          questionRepo.create({
            text: q.question,
            based_on: q.based_on,
            section: q.section,
            request,
          }),
        );

        await manager.save(questions);

        request.status = "completed";
        request.vector_id = vectorResult.storeId;

        await manager.save(request);

        resultDto.status = "completed";
      } catch (error) {
        this.logger.error(`fail: ${request.id}`, error.stack);

        request.status = "failed";

        await manager.save(request);

        throw new InternalServerErrorException("질문 생성 중 오류 발생.");
      }
    });

    return resultDto;
  }

  async getQuestions(id: string) {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: ["questions"],
    });

    if (!request) {
      throw new NotFoundException("해당 id의 생성 요청이 없습니다.");
    }

    if (request.questions.length === 0) {
      throw new NotFoundException("질문이 생성되지 않았습니다.");
    }

    const result = request.questions.map((q) => ({
      id: q.id,
      text: q.text,
      based_on: q.based_on,
      section: q.section,
    }));

    return { questions: result };
  }

  async getRequest(requestId: string): Promise<GQRequestResponseDto> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException("해당 id의 생성 요청이 없습니다.");
    }

    return { request_id: request.id, status: request.status };
  }

  async questionGenerator(resume: string, job: string) {
    const prompt_text = QuestionGeneratorPrompt(resume, job);

    const response = await this.openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content:
            "당신은 어떤 직군이든 면접 질문을 만들어낼 수 있는 전문 면접관입니다.",
        },
        { role: "user", content: prompt_text },
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;

    try {
      const parsed: { questions: any[] } = JSON.parse(content ?? "");

      return parsed;
    } catch (error) {
      console.log(error);
      throw new Error();
    }
  }

  async streamQuestionGenerator(requestId: string, res: Response) {
    const requestEntity = await this.requestRepo.findOneOrFail({
      where: { id: requestId },
    });

    let closed = false;
    const safeEnd = () => {
      if (!closed) {
        closed = true;
        clearInterval(heartbeat);
        if (!res.writableEnded) res.end();
      }
    };

    const heartbeat = this.startHeartbeat(res);

    this.writeEvent(res, { retryMs: 1000 });

    requestEntity.status = "working";
    await this.requestRepo.save(requestEntity);

    const limits = { basic: 3, experience: 6, job_related: 5, expertise: 6 };
    const limitCount = Object.values(limits).reduce((sum, v) => sum + v, 0);

    let createdTotal = 0;

    const pt = new PassThrough({ encoding: "utf8" });
    const pipeline = chain([
      pt,
      parser(),
      pick({ filter: "questions" }),
      streamArray(),
    ]);

    let eid = 0;
    const nextId = () => ++eid;

    pipeline.on("data", ({ value }) => {
      try {
        const item = QuestionItem.parse(value);

        createdTotal += 1;

        this.writeEvent(res, {
          id: nextId(),
          event: "question",
          data: { type: "question", ...item },
        });
        this.writeEvent(res, {
          id: nextId(),
          event: "progress",
          data: { type: "progress", ...{ limitCount, createdTotal } },
        });
      } catch (error) {
        this.writeEvent(res, {
          id: nextId(),
          event: "warn",
          data: { reason: "schema_invalid" },
        });
      }
    });

    pipeline.on("end", async () => {
      this.writeEvent(res, {
        id: nextId(),
        event: "progress",
        data: { type: "progress", ...{ limitCount, createdTotal } },
      });

      // db 반영
      try {
        const result = await stream.finalResponse();

        const questions = result.output_parsed.questions.map((q) =>
          this.questionRepo.create({
            request: requestEntity,
            text: q.text,
            based_on: q.based_on,
            section: q.section,
          }),
        );

        await this.questionRepo.save(questions);

        requestEntity.status = "completed";
        await this.requestRepo.save(requestEntity);

        this.writeEvent(res, {
          id: nextId(),
          event: "completed",
          data: { type: "completed", msg: "[DONE]" },
        });
      } catch (error) {
        if (!res.writableEnded) {
          this.writeEvent(res, {
            id: nextId(),
            event: "failed",
            data: { reason: "db_error", msg: String(error), type: "failed" },
          });
        }

        console.error("DB error:", error);
        requestEntity.status = "failed";

        await this.requestRepo.save(requestEntity);
      } finally {
        safeEnd();
      }
    });

    pipeline.on("error", (error) => {
      if (!res.writableEnded) {
        this.writeEvent(res, {
          id: nextId(),
          event: "failed",
          data: { reason: "parse_error", msg: String(error) },
        });
      }
      safeEnd();
    });

    const prompt_text = QuestionGeneratorPromptV5_1_1(
      requestEntity.resume_text,
      requestEntity.job_text,
      limits,
    );

    const schema = makeQuestionSchema(limitCount);
    const format = zodTextFormat(schema, "generated_questions");

    const stream = this.openai.responses.stream({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content:
            "당신은 어떤 직군이든 면접 질문을 만들어낼 수 있는 전문 면접관입니다.",
        },
        { role: "user", content: prompt_text },
      ],
      text: { format: format },
      reasoning: { effort: "low" },
    });

    stream.on("response.output_text.delta", (e: any) => pt.write(e.delta));
    stream.on("response.completed", () => pt.end());
    stream.on("error", () => {
      pt.destroy(new Error("openai_stream_error"));
    });

    res.on("close", () => {
      try {
        (stream as any).abort()?.();
      } catch {}

      try {
        pt.destroy();
      } catch {}

      safeEnd();
    });
  }

  async streamMockData(res: Response) {
    await new Promise((r) => setTimeout(r, 3000));

    const heartbeat = this.startHeartbeat(res, 15000);

    let closed = false;
    const safeEnd = () => {
      if (!closed) {
        closed = true;
        clearInterval(heartbeat);
        if (!res.writableEnded) res.end();
      }
    };

    this.writeEvent(res, { retryMs: 1000 });

    let eid = 0;
    const nextId = () => ++eid;

    const limitCount = 5;

    try {
      for (let i = 0; i < limitCount; i++) {
        const item = MOCK_QUESTIONS[i];

        this.writeEvent(res, {
          id: nextId(),
          event: "question",
          data: { type: "question", ...item },
        });
        this.writeEvent(res, {
          id: nextId(),
          event: "progress",

          data: {
            type: "progress",
            ...{ limitCount, createdTotal: i + 1 },
          },
        });

        await new Promise((r) => setTimeout(r, 1000));
      }

      this.writeEvent(res, {
        id: nextId(),
        event: "completed",
        data: { type: "completed", msg: "[DONE]" },
      });
    } catch (e) {
      this.writeEvent(res, {
        id: nextId(),
        event: "failed",
        data: { reason: "mock_error", msg: String(e), type: "failed" },
      });
    } finally {
      safeEnd();
    }
  }

  // new
  async createRequest(
    dto: CreateQuestionRequestDto,
  ): Promise<GenerateResponseDto> {
    const resultDto: GenerateResponseDto = {
      request_id: null,
      status: "failed",
    };

    await this.dataSource.transaction(async (manager) => {
      const request = manager.create(GenerateRequest, {
        resume_text: dto.resume_text,
        job_text: dto.job_text,
        status: "pending",
      });

      await manager.save(request);

      resultDto.request_id = request.id;

      try {
        this.logger.log(`vector store에 업로드 중... ${request.id}`);

        const vectorResult = await this.ai.saveToVectorStore({
          resumeText: dto.resume_text,
          jobText: dto.job_text,
          requestId: request.id,
        });

        console.log(vectorResult);
        // await this.vectorStoreService.save(
        //   dto.resume_text,
        //   dto.job_text,
        //   request.id,
        // );

        request.vector_id = vectorResult.storeId;
        await manager.save(request);
        resultDto.status = "completed";
      } catch (error) {
        this.logger.error(`fail: ${request.id}`, error.stack);

        request.status = "failed";

        await manager.save(request);
        // await this.vectorStoreService
        //   .deleteByRequestId(request.id)
        //   .catch((e) => {
        //     this.logger.warn(`fail: vector 삭제 실패 ${request.id}`, e.stack);
        //   });

        throw new InternalServerErrorException("Request 생성 중 오류 발생.");
      }
    });

    return resultDto;
  }

  writeEvent(res: Response, { id, event, data, retryMs }: WriteEventOpts) {
    if (res.writableEnded) return;

    if (retryMs != null) res.write(`retry: ${retryMs}\n`);

    if (id != null) res.write(`id: ${id}\n`);

    if (event) res.write(`event: ${event}\n`);

    if (data !== undefined) {
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      res.write(`data: ${payload}\n\n`);
    } else {
      res.write(`\n`);
    }
  }

  startHeartbeat(res: Response, ms = 15000) {
    return setInterval(() => {
      if (!res.writableEnded) res.write(`:hb ${Date.now()}\n\n`);
    }, ms);
  }

  // insert
  async insertQuestions(requestId: string, dto: InsertQuestionsBodyDto) {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
    });

    const questions = dto.questions.map((q) =>
      this.questionRepo.create({
        request: request,
        text: q.text,
        based_on: q.based_on,
        section: q.section,
      }),
    );

    await this.questionRepo.save(questions);

    request.status = "completed";
    await this.requestRepo.save(request);
  }
}
