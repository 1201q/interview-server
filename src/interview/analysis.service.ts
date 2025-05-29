import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

import { InterviewSession } from "./entities/interview.session.entity";
import { Repository } from "typeorm";
import { InterviewSessionQuestion } from "./entities/interview.session.question.entity";

import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { EvaluationStandard } from "src/common/interfaces/analysis.interface";

@Injectable()
export class AnalysisService {
  private openai: OpenAI;

  constructor(
    @InjectRepository(InterviewSession)
    private sessionRepository: Repository<InterviewSession>,

    @InjectRepository(InterviewSessionQuestion)
    private sessionQuestionRepository: Repository<InterviewSessionQuestion>,
    private readonly configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get("OPENAI_API_KEY"),
    });
  }

  async generateEvaluations(
    questions: { question_text: string; question_id: string }[],
  ) {
    const prompt = this.getEvaluationsPrompt(questions);

    const reponse = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "당신은 시니어 개발자 면접관이자 평가 기준 설계 전문가입니다. 주어진 기술 면접 질문 목록을 분석하여, 각 질문의 평가 목적과 평가 항목(핵심 기준 및 보조 기준)을 정의하는 것이 당신의 임무입니다. 질문들을 통해 지원자의 직무를 먼저 추론한 후, 해당 직무 기준에 맞는 평가 항목을 생성해야 합니다.",
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
      const parsed: EvaluationStandard = JSON.parse(content ?? "");

      console.log(parsed);
      return parsed;
    } catch (error) {
      console.log(error);
      throw new Error();
    }
  }

  private getEvaluationsPrompt(
    questions: { question_text: string; question_id: string }[],
  ) {
    const questionList = questions
      .map(
        (q, i) =>
          `${i + 1}. (question_id: ${q.question_id}) question_text: ${q.question_text.trim()}`,
      )
      .join("\n");

    return `
      너는 개발 직군 기술 면접관이야. 아래는 한 지원자가 선택한 면접 질문 목록이야.
      실제 면접이기 때문에 지원자를 검증하고, 평가하기 위한 기준을 만들어야 해.

      📌 수행할 일:
      1. 이 질문들을 보고 이 지원자의 직무가 무엇일지 추론해줘. 예시: ["프론트엔드", "웹 풀스택", "백엔드", "안드로이드"]
      2. 각 질문에 대해 아래 형식으로 평가 기준을 만들어줘:
        - 'intent': 이 질문의 평가 목적을 작성.
        - "core_criteria": 가장 중요하게 평가할 항목 2~3개
        - "supplementary_criteria": 보조적으로 평가할 항목 1~2개
        - "expected_keywords": 해당 질문의 답변에서 꼭 언급되어야 할 핵심 키워드 배열 (한글 기반, 필요시 영어 혼용)

      📌 제약 조건:
      1. 평가 기준은 반드시 위에서 추론한 직무에 맞게 생성해야 해:
        - 예를 들면, '클래스는 무엇이고 객체는 무엇인가요?', '이벤트는 어떤 형태로 전달되나요? 터치 이벤트는 다른게 있나요?'와 같은 질문은
          각각을 보았을 때, 어떤 직군인지를 몰라. 하지만 다른 질문들을 보았을 때, 'xml에서 view가 그려지는 과정에 대해 설명해주세요.'와 같은 질문들이 있다면,
          앞의 질문들은 '안드로이드 개발' 직군에 맞는 평가 기준을 적용해서 평가해야 한다는 것을 알 수 있어.
          즉, 각각의 질문별로가 아니라, 전체 질문들을 고려해서 직무를 먼저 파악한 다음, 각 질문에 대한 평가 기준을 생성해야 함.
          
      2. 질문의 의도에 따라 평가 기준을 잘 선정해야 해:
        - 예를 들면, 질문이 지원자의 전공 지식이나 개발 지식의 숙지 여부에 대해 묻는 질문이라면, 주로 지원자의 지식을 검증하는 방향으로 기준과 중요도를 선정해야 하고,
          자신의 경험이나 과거의 이러한 문제를 어떻게 해결했는지를 묻는 질문인지라면, 지원자의 과거 경험이나, 문제의 해결 과정을 검증하는 방향으로 선정해야 함.

      3. core_criteria와 supplementary_criteria 안의 각 항목은 다음 구조로 작성해:
        - key: 영어 항목명
        - value: { description: 한글 설명, weight: 항목의 평가 비중 (0~100 중 정수) }
        - 각 질문의 모든 항목의 weight 총합은 반드시 100이 되도록 작성해야 해.

      4. expected_keywords 항목을 각 질문에 포함해줘. 답변에 포함되어야 할 핵심 키워드들을 배열 형태로 작성하며, 한국어가 기본이나 기술 용어라면 영어도 혼용 가능.
      

      📌 절대 지켜야 할 출력 조건:
      1. 반드시 JSON 형식만 출력
      2. 코드 블럭 (\`\`\`) 사용 금지
      3. 불필요한 설명, 서두/말미 텍스트 출력 금지
      4. 각 질문에는 question_id와 question_text를 반드시 포함

      📌 출력 예시:
      {
        "job_role": "백엔드",
        "question_evaluations": [
          {
            "question_id": "q1",
            "question_text": "세션과 JWT의 차이를 설명해주세요.",
            "intent": "웹 인증 방식의 구조적 차이와 보안적 특성에 대한 이해를 평가하기 위한 질문입니다.",
            "core_criteria": {
              "Conceptual Understanding": {
                "description": "세션과 JWT 구조의 차이를 명확히 설명했는가",
                "weight": 60
              },
              "Security Considerations": {
                "description": "각 방식의 보안적 특징을 설명할 수 있는가",
                "weight": 30
              }
            },
            "supplementary_criteria": {
              "Practical Example": {
                "description": "실제 프로젝트에서 적용한 경험을 언급했는가",
                "weight": 10
              }
            },
            "expected_keywords": ["세션", "JWT", "상태 저장", "토큰", "서버 메모리", "탈취"]
          }
        ]
      }


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

  async updateEvaluationStandard(
    sessionId: string,
    result: EvaluationStandard,
  ) {
    await this.sessionRepository.update(sessionId, {
      evaluation_standard: JSON.stringify(result),
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

  async getEvaluationStandard(sessionId: string) {
    const result = await this.sessionRepository.findOne({
      where: {
        id: sessionId,
      },
      select: ["evaluation_standard"],
    });

    const parsed: EvaluationStandard = JSON.parse(result.evaluation_standard);

    return parsed;
  }
}
