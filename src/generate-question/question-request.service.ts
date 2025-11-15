import {
  BadRequestException,
  ConflictException,
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
import { OpenAIService } from "@/openai-service/openai.service";

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
    dto: CreateQuestionRequestDto & { userId: string },
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
          user_id: dto.userId,
        });

        const saved = await manager.save(request);

        let storeId: string;

        try {
          const vectorResult = await this.ai.saveToVectorStore({
            resumeText: dto.resume_text,
            jobText: dto.job_text,
            requestId: saved.id,
          });

          storeId = vectorResult.storeId;

          this.logger.log(`Vector store saved with ID: ${storeId}`);
        } catch (error) {
          this.logger.error(`Failed to save to vector store: ${error.message}`);
          throw new InternalServerErrorException(
            "Failed to process question request",
          );
        }

        await manager.update(
          GenerateRequest,
          { id: saved.id },
          { vector_id: storeId },
        );

        this.logger.log(`GenerateRequest created with ID: ${saved.id}`);

        resultDto.request_id = saved.id;
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
  async markWorking(
    requestId: string,
    userId: string,
  ): Promise<GenerateRequest> {
    const req = await this.requestRepo.findOne({
      where: { id: requestId, user_id: userId },
    });

    if (!req) {
      throw new NotFoundException("해당 id의 생성 요청이 없습니다.");
    }

    if (req.status === "working") {
      return req;
    }

    if (req.status === "completed") {
      throw new ConflictException("이미 질문 생성이 완료된 요청입니다.");
    }

    if (req.status === "failed") {
      throw new BadRequestException(
        "이 요청은 질문 생성에 실패했습니다. 새 요청을 다시 생성해주세요.",
      );
    }

    if (req.status !== "pending") {
      throw new InternalServerErrorException(
        `알 수 없는 요청 상태입니다: ${req.status}`,
      );
    }

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

  async getQuestionsByRequestId(requestId: string, userId: string) {
    const request = await this.requestRepo.findOne({
      where: { id: requestId, user_id: userId },
      relations: ["questions"],
    });

    if (!request) {
      throw new NotFoundException("해당 id의 생성 요청이 없습니다.");
    }

    if (!request.questions || request.questions.length === 0) {
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

  async getRequest(
    requestId: string,
    userId: string,
  ): Promise<GQRequestResponseDto> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId, user_id: userId },
    });

    if (!request) {
      throw new NotFoundException("해당 id의 생성 요청이 없습니다.");
    }

    return { request_id: request.id, status: request.status };
  }

  // 질문 직접 삽입 (테스트용)
  async insertQuestions(
    requestId: string,
    userId: string,
    dto: InsertQuestionsBodyDto,
  ) {
    const request = await this.requestRepo.findOne({
      where: { id: requestId, user_id: userId },
    });

    if (!request)
      throw new NotFoundException("해당 id의 생성 요청이 없습니다.");

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
