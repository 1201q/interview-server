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
  GQRequestResponseDto,
  InsertQuestionsBodyDto,
} from "./generate-question.dto";

import { QuestionItem } from "@/common/interfaces/common.interface";
import { OpenAIService } from "@/llm/openai.service";

@Injectable()
export class QuestionRequestService {
  private readonly logger = new Logger(QuestionRequestService.name);

  constructor(
    @InjectRepository(GenerateRequest)
    private readonly requestRepo: Repository<GenerateRequest>,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    private readonly dataSource: DataSource,

    private readonly ai: OpenAIService,
  ) {}

  // 질문 생성 요청
  // 트랜잭션 내에서 벡터 스토어 저장 및 DB 저장 처리
  async createRequest(
    dto: CreateQuestionRequestDto,
  ): Promise<GQRequestResponseDto> {
    const resultDto: GQRequestResponseDto = {
      request_id: null,
      status: "failed",
    };

    try {
      await this.dataSource.transaction(async (manager) => {
        const request = manager.create(GenerateRequest, {
          resume_text: dto.resume_text,
          job_text: dto.job_text,
          status: "pending",
        });

        try {
          const vectorResult = await this.ai.saveToVectorStore({
            resumeText: dto.resume_text,
            jobText: dto.job_text,
            requestId: request.id,
          });

          this.logger.log(
            `Vector store saved with ID: ${vectorResult.storeId}`,
          );

          request.vector_id = vectorResult.storeId;
        } catch (error) {
          this.logger.error(`Failed to save to vector store: ${error.message}`);
          throw new InternalServerErrorException(
            "Failed to process question request",
          );
        }

        await manager.save(request);

        this.logger.log(`GenerateRequest created with ID: ${request.id}`);

        resultDto.request_id = request.id;
        resultDto.status = request.status;
      });
    } catch (error) {
      this.logger.error(`Failed to create request: ${error.message}`);
      throw new InternalServerErrorException(
        "Failed to create question request",
      );
    }

    return resultDto;
  }

  // 요청 상태를 'working'으로 변경
  async markWorking(requestId: string): Promise<GenerateRequest> {
    const req = await this.requestRepo.findOneByOrFail({ id: requestId });

    req.status = "working";
    return this.requestRepo.save(req);
  }

  // 입력 받은 질문들을 DB에 저장하고 요청 상태를 'completed'로 변경
  async completeWithQuestions(request: GenerateRequest, items: QuestionItem[]) {
    const questions = items.map((q) =>
      this.questionRepo.create({
        request,
        text: q.text,
        based_on: q.based_on,
        section: q.section,
      }),
    );

    await this.questionRepo.save(questions);
    request.status = "completed";
    await this.requestRepo.save(request);
  }

  async fail(request: GenerateRequest) {
    await this.requestRepo.update(request.id, { status: "failed" });
  }

  async getQuestionsByRequestId(requestId: string) {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
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

  // 질문 직접 삽입 (테스트용)
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
