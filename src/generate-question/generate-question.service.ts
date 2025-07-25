import {
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
import { QuestionGeneratorPrompt } from "src/common/prompts/question-generator.prompt";
import { Response } from "express";
import { generatedQuestionFormat } from "src/common/schemas/prompt.schema";
import { MOCK_QUESTIONS } from "src/common/constants/mock-question";

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

    const result = request.questions.map((q) => ({
      id: q.id,
      text: q.text,
      based_on: q.based_on,
      section: q.section,
    }));

    return { questions: result };
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
    const request = await this.requestRepo.findOneOrFail({
      where: { id: requestId },
    });

    const prompt_text = QuestionGeneratorPrompt(
      request.resume_text,
      request.job_text,
    );

    const stream = this.openai.responses.stream({
      model: "gpt-4.1",
      input: [
        {
          role: "system",
          content:
            "당신은 어떤 직군이든 면접 질문을 만들어낼 수 있는 전문 면접관입니다.",
        },
        { role: "user", content: prompt_text },
      ],

      text: {
        format: generatedQuestionFormat,
      },

      temperature: 0.7,
    });

    let buffer = "";

    stream.on("response.output_text.delta", (e) => {
      buffer += e.delta;

      if (e.delta.includes("}")) {
        if (buffer.includes("questions") && buffer.includes("[")) {
          buffer = buffer.substring(buffer.indexOf("[") + 1);
        }

        try {
          const parsed = JSON.parse(
            buffer.substring(buffer.indexOf("{"), buffer.indexOf("}") + 1),
          );
          console.log("@@@@@@@@@@@@@@@@@@@@@@@");
          console.log(parsed);
          console.log("@@@@@@@@@@@@@@@@@@@@@@@");
          res.write(`event: question\ndata: ${JSON.stringify(parsed)}\n\n`);
        } catch (error) {
          console.log(error);
        }

        buffer = "";
      }
    });

    stream.on("response.output_text.done", () => {
      res.write("data: [DONE]\n\n");
      res.end();
    });

    stream.on("error", (event) => {
      console.log(event);
      res.end();
    });

    const result = await stream.finalResponse();

    console.log(result.output_parsed.questions.length);
    console.log(result.output_parsed);
  }

  async streamMockData(res: Response) {
    for (const q of MOCK_QUESTIONS) {
      res.write(`event: question\ndata: ${JSON.stringify(q)}\n\n`);
      await new Promise((r) => setTimeout(r, 1000));
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

  async streamQuestionGeneratorAndSave(requestId: string) {
    const request = await this.requestRepo.findOneOrFail({
      where: { id: requestId },
    });
    console.log(request);
  }
}
