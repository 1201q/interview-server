import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { DataSource, EntityManager, Repository } from "typeorm";
import {
  Answer,
  InterviewSession,
  Question,
} from "../../common/entities/entities";
import {
  CreateInterviewSessionDto,
  InterviewJobRoleDto,
  InterviewSessionDetailDto,
  KeywordsForSttDto,
} from "./session.dto";
import { SessionQuestionService } from "../question/question.service";
import { InterviewRolePrompt } from "src/common/prompts/interview-role.prompt";
import OpenAI from "openai";
import { ConfigService } from "@nestjs/config";
import {
  KeywordsForSttDtoSchema,
  sttKeywordFormat,
} from "src/common/schemas/prompt.schema";
import { SttKeywordPrompt } from "src/common/prompts/stt-keyword.prompt";

@Injectable()
export class InterviewSessionService {
  private openai: OpenAI;

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly questionService: SessionQuestionService,

    @InjectRepository(InterviewSession)
    private readonly sessionRepo: Repository<InterviewSession>,

    @InjectRepository(Answer)
    private readonly answerRepo: Repository<Answer>,
  ) {
    this.openai = new OpenAI({
      apiKey: this.config.get("OPENAI_API_KEY"),
    });
  }

  async createSession(dto: CreateInterviewSessionDto) {
    return this.dataSource.transaction(async (manager) => {
      // 1. 세션 생성
      const session = manager.create(InterviewSession, {
        user_id: dto.user_id,
        status: "not_started",
        request: { id: dto.request_id },
      });

      await manager.save(session);

      // 2. session Question 생성.
      const sessionQuestions = await this.questionService.bulkCreateQuestions(
        session,
        dto.questions,
        manager,
      );

      // 3. answer 생성
      const answerRepo = manager.getRepository(Answer);
      const answers = sessionQuestions.map((sq) =>
        answerRepo.create({
          session_question: sq,
          status: "waiting",
        }),
      );

      await answerRepo.save(answers);

      return { id: session.id, status: session.status };
    });
  }

  async getSessionDetail(id: string): Promise<InterviewSessionDetailDto> {
    const session = await this.sessionRepo.findOne({
      where: { id },
      relations: [
        "session_questions",
        "session_questions.question",
        "session_questions.answers",
        "session_questions.answers.analyses",
      ],
    });

    if (!session) {
      throw new NotFoundException("세션을 찾을 수 없습니다.");
    }

    return {
      id: session.id,
      status: session.status,
      created_at: session.created_at.toISOString(),
      questions: session.session_questions.map((sq) => ({
        id: sq.id,
        question_id: sq.question.id,
        order: sq.order,
        type: sq.type,
        text: sq.type === "main" ? sq.question.text : sq.followup_text,
        status: sq.answers[0]?.status ?? "waiting",
        answer: sq.answers[0]?.text ?? null,
      })),
    };
  }

  async startSession(sessionId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ["session_questions", "session_questions.answers"],
    });

    if (!session) {
      throw new NotFoundException("세션을 찾을 수 없습니다.");
    }

    if (session.status !== "not_started") {
      throw new Error("이미 세션이 시작되었습니다.");
    }

    session.status = "in_progress";
    await this.sessionRepo.save(session);

    const firstQuestion = session.session_questions.sort(
      (a, b) => a.order - b.order,
    )[0];

    const firstAnswers = firstQuestion.answers[0];

    if (firstAnswers) {
      await this.answerRepo.update(firstAnswers.id, { status: "ready" });
    }

    return { id: session.id, status: session.status };
  }

  async finishSession(manager: EntityManager, sessionId: string) {
    const repo = manager.getRepository(InterviewSession);

    const session = await repo.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException("세션을 찾을 수 없습니다.");
    }

    if (session.status !== "in_progress") {
      throw new Error("진행 중인 세션만 종료할 수 있습니다.");
    }

    await repo.update(sessionId, { status: "completed" });
  }

  async getJobRoleFromSessionId(
    sessionId: string,
  ): Promise<InterviewJobRoleDto> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ["request"],
    });

    if (!session) {
      throw new NotFoundException("세션을 찾을 수 없습니다.");
    }

    return await this.inferRoleFromJobText(session.request.job_text);
  }

  async getJobRoleFromJobText(jobText: string): Promise<InterviewJobRoleDto> {
    return await this.inferRoleFromJobText(jobText);
  }

  async getKeywordsForStt(sessionId: string): Promise<KeywordsForSttDto> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ["session_questions.question"],
    });

    if (!session) {
      throw new NotFoundException("세션을 찾을 수 없습니다.");
    }

    const questions = session.session_questions.map((sq) => sq.question);

    return await this.inferKeywordsForStt(questions);
  }

  async inferRoleFromJobText(jobText: string): Promise<InterviewJobRoleDto> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-5-nano",
        messages: [
          {
            role: "system",
            content: "당신의 임무는 채용공고로부터 직군명을 추정하는 것입니다.",
          },
          {
            role: "user",
            content: InterviewRolePrompt(jobText),
          },
        ],
        reasoning_effort: "medium",
        response_format: { type: "text" },
      });

      const content = response.choices[0].message.content;

      if (!content) {
        return {
          status: "failed",
        };
      }

      return {
        status: "completed",
        job_role: content,
      };
    } catch (error) {
      return {
        status: "failed",
      };
    }
  }

  async inferKeywordsForStt(questions: Question[]) {
    try {
      const response = await this.openai.responses.parse({
        model: "gpt-5-mini",
        input: [
          {
            role: "system",
            content:
              "당신은 각 질문에 대해 음성 전사를 돕는 STT 키워드 목록을 산출하는 도우미입니다.",
          },
          {
            role: "user",
            content: SttKeywordPrompt(questions),
          },
        ],
        text: {
          format: sttKeywordFormat,
        },
        reasoning: { effort: "minimal" },
      });

      const parsed = response.output_parsed;

      const safe = KeywordsForSttDtoSchema.safeParse(parsed);

      if (!safe.success) {
        console.error(safe.error);

        return {
          keywords: questions.map((q) => ({
            id: q.id,
            stt_keywords: [],
          })),
        };
      }

      const items = new Map(
        safe.data.keywords.map((i) => [i.id, i.stt_keywords]),
      );

      const array = questions.map((q) => ({
        id: q.id,
        stt_keywords: items.get(q.id) ?? [],
      }));

      return { keywords: array };
    } catch (error) {
      console.error(error);

      return {
        keywords: questions.map((q) => ({ id: q.id, stt_keywords: [] })),
      };
    }
  }

  // reset
  async resetSession(sessionId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ["session_questions", "session_questions.answers"],
    });

    if (!session) {
      throw new NotFoundException("세션을 찾을 수 없습니다.");
    }

    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(InterviewSession)
        .update(session.id, { status: "not_started" });

      for (const sq of session.session_questions) {
        for (const ans of sq.answers ?? []) {
          console.log(ans);
          await manager.getRepository(Answer).update(ans.id, {
            status: "waiting",
            audio_path: null,
            text: null,
            started_at: null,
            ended_at: null,
          });
        }
      }
    });

    return { id: session.id, status: "not_started" };
  }
}
