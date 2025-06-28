import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { Repository } from "typeorm";

import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { QuestionType } from "src/common/interfaces/common.interface";
import { AnalysisProgress } from "src/common/interfaces/analysis.interface";
import NewInterviewSession from "./entities/new.interview.session.entity";
import { NewInterviewAnswer } from "./entities/new.interview.answer.entity";

@Injectable()
export class AnalysisService {
  private openai: OpenAI;

  constructor(
    @InjectRepository(NewInterviewSession)
    private sessionRepository: Repository<NewInterviewSession>,

    @InjectRepository(NewInterviewAnswer)
    private sessionQuestionRepository: Repository<NewInterviewAnswer>,
    private readonly configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get("OPENAI_API_KEY"),
    });
  }

  async generateJobRole(
    questions: {
      question_text: string;
      question_id: string;
      question_role: QuestionType;
    }[],
  ) {
    const prompt = this.getJobRolePrompt(questions);

    const reponse = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "당신은 시니어 개발자 면접관입니다. 기술 면접 질문을 기반으로 지원자의 직무를 유추하는 것이 당신의 임무입니다.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const content = reponse.choices[0]?.message?.content;

    try {
      const result: { job_role: string } = JSON.parse(content ?? "");
      console.log(result);
      return result;
    } catch (error) {
      console.log(error);
      throw new Error();
    }
  }

  private getJobRolePrompt(
    questions: {
      question_text: string;
      question_id: string;
      question_role: QuestionType;
    }[],
  ) {
    const questionList = questions
      .map(
        (q, i) =>
          `${i + 1}. (question_text: ${q.question_text.trim()} question_role: ${q.question_role === "ai" || q.question_role === "user" ? "미정." : q.question_role}`,
      )
      .join("\n");

    return `
      너는 지금 시니어 개발자 면접관이야. 아래는 한 지원자가 선택한 기술 면접 질문 목록이야.

      각 질문을 보고 이 지원자가 어떤 직무에 지원했을 가능성이 높은지 추론해줘.
      예시는 다음과 같아: ["프론트엔드", "백엔드", "웹 풀스택", "안드로이드", "IOS", "데브옵스", "데이터 엔지니어", "AI/ML 엔지니어"]

      📌 수행할 일:
      1. 이 질문들을 보고 이 지원자의 직무가 무엇일지 추론해줘.
      2. 입력한 질문 형식은 question_text, question_role이 있어.
      - question_role은 fe, be, android, ios, 미정이 있어. 
      - fe, be, android, ios 중 하나일 경우는 해당 질문이 프론트엔드, 백엔드, 안드로이드, IOS로 등록되었음을 뜻함.
      - user일 경우는 "user가 생성한 질문"이라는 뜻이야. 질문의 타입은 너가 추론해야함.
      - ai일 경우는 "ai가 생성한 질문"이라는 뜻이야. 질문의 타입은 너가 추론해야함.
      3. 예를 들어, question_text가 "제네릭에 대해 설명해주세요.", question_role이 "android" 라는 질문이 있다고 가정하자.
      - 제네릭에 대해 설명해주세요.라는 질문 자체는 fe, be, android, ios.... 다른 직군의 지원자 모두가 선택가능한 질문이기 때문에,
        다른 질문들까지 모두 보고 직무를 추론해야 함.
      - 질문들을 다 봤는데도 하나의 직무로 추론이 애매한 경우, 각 질문의 question_role을 참고해서 추론할 것.


      📌 출력 형식은 다음과 같아:
      {
        "job_role": "직무명"
      }

      📌 절대 지켜야 할 출력 조건:
      1. 반드시 JSON 형식만 출력
      2. 코드 블럭 (\`\`\`) 사용 금지
      3. 설명이나 주석 절대 금지
      4. job_role 키는 그대로 유지
      5. 질문 목록은 전체적으로 보고 유력한 하나의 직무만 추론하되, 사용자가 완전히 상반된 질문을 선택한 경우, "직무명1, 직무명2" 이렇게 반환.

      질문 목록:
      ${questionList}
      `;
  }

  async completeAnalysis(questionId: string, result: any) {
    await this.sessionQuestionRepository.update(questionId, {
      analysis_result: JSON.stringify(result),
      analysis_status: "completed",
    });
  }

  async markAnalysisFailed(questionId: string) {
    await this.sessionQuestionRepository.update(questionId, {
      analysis_status: "failed",
    });
  }

  async getAnalysisResult(questionId: string) {
    return this.sessionQuestionRepository.findOne({
      where: {
        id: questionId,
      },
    });
  }

  async getAnalysisProgress(sessionId: string): Promise<AnalysisProgress> {
    const statuses = await this.sessionQuestionRepository.find({
      where: { session: { id: sessionId } },
      select: ["analysis_status"],
    });

    const total = statuses.length;

    if (statuses.length === 0) {
      return { total: 0, done: 0, percent: 0, status: "pending" };
    }

    const done = statuses.filter(
      (q) =>
        q.analysis_status === "completed" || q.analysis_status === "failed",
    ).length;

    const isProcessing = statuses.some(
      (q) => q.analysis_status === "processing",
    );

    const status =
      done === total ? "done" : isProcessing ? "loading" : "pending";

    return {
      total,
      done,
      percent: Math.round((done / total) * 100),
      status,
    };
  }
}
