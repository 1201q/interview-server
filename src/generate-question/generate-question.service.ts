import {
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { VectorStoreService } from "src/external-server/vector-store.service";

import { DataSource, Repository } from "typeorm";
import { Question, GenerateRequest } from "../common/entities/entities";
import {
  CreateQuestionRequestDto,
  GenerateResponseDto,
} from "./generate-question.dto";
import OpenAI from "openai";
import { ConfigService } from "@nestjs/config";
import {
  QuestionGeneratorPrompt,
  QuestionGeneratorPromptV2,
  QuestionGeneratorSystemPrompt,
} from "src/common/prompts/question-generator.prompt";
import { Response } from "express";
import {
  generatedQuestionFormat,
  QuestionItem,
} from "src/common/schemas/prompt.schema";
import { MOCK_QUESTIONS } from "src/common/constants/mock-question";

import { PassThrough } from "stream";

import { chain } from "stream-chain";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/Pick";
import { streamArray } from "stream-json/streamers/StreamArray";

@Injectable()
export class GenerateQuestionService {
  private openai: OpenAI;
  private readonly logger = new Logger(GenerateQuestionService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,

    private readonly vectorStoreService: VectorStoreService,

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
    const resultDto: GenerateResponseDto = { id: null, status: "failed" };

    await this.dataSource.transaction(async (manager) => {
      const request = manager.create(GenerateRequest, {
        resume_text: dto.resume_text,
        job_text: dto.job_text,
        status: "working",
      });

      await manager.save(request);

      resultDto.id = request.id;

      try {
        this.logger.log(`vector store에 업로드 중... ${request.id}`);

        await this.vectorStoreService.save(
          dto.resume_text,
          dto.job_text,
          request.id,
        );

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
        request.vector_id = request.id;

        await manager.save(request);

        resultDto.status = "completed";
      } catch (error) {
        this.logger.error(`fail: ${request.id}`, error.stack);

        request.status = "failed";

        await manager.save(request);
        await this.vectorStoreService
          .deleteByRequestId(request.id)
          .catch((e) => {
            this.logger.warn(`fail: vector 삭제 실패 ${request.id}`, e.stack);
          });

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

    return { status: "ok", questions: result };
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

    const heartbeat = setInterval(() => res.write(":hb\n\n"), 15000);
    let closed = false;

    const safeEnd = () => {
      if (!closed) {
        closed = true;
        clearInterval(heartbeat);
        res.end();
      }
    };

    requestEntity.status = "working";
    await this.requestRepo.save(requestEntity);

    const limits = { basic: 3, experience: 6, job_related: 4, expertise: 7 };
    const limitCount = Object.values(limits).reduce((sum, v) => sum + v, 0);

    let createdTotal = 0;

    const prompt_text = QuestionGeneratorPromptV2(
      requestEntity.resume_text,
      requestEntity.job_text,
      limits,
    );

    const pt = new PassThrough({ encoding: "utf8" });
    const pipeline = chain([
      pt,
      parser(),
      pick({ filter: "questions" }),
      streamArray(),
    ]);

    pipeline.on("data", ({ value }) => {
      try {
        const item = QuestionItem.parse(value);

        createdTotal += 1;

        res.write(`event: question\ndata: ${JSON.stringify(item)}\n\n`);
        res.write(
          `event: progress\ndata:${JSON.stringify({ limitCount, createdTotal })}\n\n`,
        );
      } catch (error) {
        res.write(
          `event: warn\ndata:${JSON.stringify({ reason: "schema_invalid" })}\n\n`,
        );
      }
    });

    pipeline.on("end", async () => {
      res.write(
        `event: progress\ndata:${JSON.stringify({ limitCount, createdTotal })}\n\n`,
      );

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

        console.log(requestEntity);

        res.write("event: done\ndata: [DONE]\n\n");
      } catch (error) {
        if (!res.writableEnded) {
          res.write(
            `event: failed\ndata:${JSON.stringify({ reason: "db_error", msg: String(error) })}\n\n`,
          );
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
        res.write(
          `event: failed\ndata:${JSON.stringify({ reason: "parse_error", msg: String(error) })}\n\n`,
        );
      }
      safeEnd();
    });

    const stream = this.openai.responses.stream({
      model: "gpt-5",
      input: [
        {
          role: "system",
          content:
            "당신은 어떤 직군이든 면접 질문을 만들어낼 수 있는 전문 면접관입니다.",
        },
        { role: "user", content: prompt_text },
      ],
      text: { format: generatedQuestionFormat },
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
    for (const q of MOCK_QUESTIONS) {
      res.write(`event: question\ndata: ${JSON.stringify(q)}\n\n`);
      await new Promise((r) => setTimeout(r, 500));
    }

    res.write("event: done\ndata: [DONE]\n\n");
    return res.end();
  }

  // new
  async createRequest(
    dto: CreateQuestionRequestDto,
  ): Promise<GenerateResponseDto> {
    const resultDto: GenerateResponseDto = { id: null, status: "failed" };

    await this.dataSource.transaction(async (manager) => {
      const request = manager.create(GenerateRequest, {
        resume_text: dto.resume_text,
        job_text: dto.job_text,
        status: "pending",
      });

      await manager.save(request);

      resultDto.id = request.id;

      try {
        this.logger.log(`vector store에 업로드 중... ${request.id}`);

        await this.vectorStoreService.save(
          dto.resume_text,
          dto.job_text,
          request.id,
        );

        request.vector_id = request.id;
        await manager.save(request);
        resultDto.status = "completed";
      } catch (error) {
        this.logger.error(`fail: ${request.id}`, error.stack);

        request.status = "failed";

        await manager.save(request);
        await this.vectorStoreService
          .deleteByRequestId(request.id)
          .catch((e) => {
            this.logger.warn(`fail: vector 삭제 실패 ${request.id}`, e.stack);
          });

        throw new InternalServerErrorException("Request 생성 중 오류 발생.");
      }
    });

    return resultDto;
  }
}
