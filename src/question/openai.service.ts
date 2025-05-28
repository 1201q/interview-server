import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

import { GenerateQuestionFromGptDto } from "./dtos/generate-question.dto";

@Injectable()
export class OpenaiService {
  private openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get("OPENAI_API_KEY"),
    });
  }

  async generateInterviewQuestions(dto: GenerateQuestionFromGptDto) {
    const prompt = this.getGenerateQuestionPrompt(dto);

    const reponse = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "당신은 개발자 지원자를 위한 인터뷰 질문을 생성하는 전문적인 기술 인터뷰어입니다",
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
      const parsed = JSON.parse(content ?? "");
      return parsed.questions as { id: number; question_text: string }[];
    } catch (error) {
      throw new Error();
    }
  }

  private getGenerateQuestionPrompt({
    jobRole,
    topic,
    question_type,
  }: GenerateQuestionFromGptDto) {
    return `너는 지금부터 개발자 면접관이야. 아래 조건을 참고해서 면접 질문 10개를 생성해줘.

      - 면접 질문 유형: ${question_type}  
      - 지원자의 직무: ${jobRole}  
      - 질문 키워드, 주제, 설명: ${topic}  

      조건:
      1. 생성되는 질문은 ${jobRole} 포지션에 맞게 기술 수준을 적절히 조절할 것.
      2. 반드시 "${question_type}" 유형에 해당하는 질문만 생성할 것.
          - "${question_type}" 외의 다른 유형(experience, system_design, comparison, implementation)은 절대 포함하지 말 것. 만약 다른 유형이 섞이면, 이를 오류로 간주한다. 
      3. 각 질문은 명확하고 실제 면접에서 사용할 수 있어야 하며, 답변이 말로 설명 가능해야 한다.
      4. 코드 작성 요구는 하지 말 것.
      5. 질문은 각각 독립적이고 중복 없이 작성할 것.
      6. **출력은 반드시 아래 JSON 포맷을 따를 것. JSON 이외 다른 출력은 절대 하지 말 것.**
      

      질문 유형 설명과 함께, 각각의 유형에 해당하는 예시를 참고해서 생성하세요.
      사용자가 ${topic}에 JWT, 세션을 입력한 경우입니다.

    - 개념 설명형(concept): 개념의 정의, 작동 원리, 목적 등을 묻는 질문
      예시: "JWT의 정의와 작동 원리를 설명해주세요."

    - 비교 설명형(comparison): 두 기술 간의 차이점, 장단점, 선택 기준 등을 묻는 질문
      예시: "JWT와 세션 기반 인증을 비교하고 장단점을 설명해주세요."

    - 시스템 설계형(system_design): 시스템 구조, 아키텍처 설계, 고려사항 등을 묻는 질문
      예시: "JWT 기반 인증 시스템을 설계할 때 고려해야 할 요소는 무엇인가요?"

    - 구현 문제형(implementation): 로직 설명을 요구하되 **코드가 아닌** 말로 설명 가능한 수준의 문제
      예시: "JWT를 통한 인증 과정을 서버와 클라이언트 입장에서 각각 설명해주세요."

    - 경험/상황형(experience): 과거 경험이나 특정 상황에서의 대처 방식을 묻는 질문
      예시: "JWT 인증 시스템을 구축하면서 겪었던 문제와 해결 방법을 공유해주세요."


      형식 예시:
      {
        "questions": [
          { "id": 1, "question_text": "JWT와 세션의 차이점을 설명해주세요." },
          { "id": 2, "question_text": "JWT를 사용하면서 겪을 수 있는 보안 이슈는 어떤 것이 있을까요?" },
          ...
        ]
      }

      이제 ${topic}에 대해 ${question_type} 유형의 질문 10개를 생성해줘.`;
  }

  async generateFeedback(questionText: string) {
    const prompt = this.getFeedbackPrompt(questionText);

    const reponse = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "당신은 개발자 면접관이며, 주어진 기술 면접 질문에 대해 지원자의 답변을 평가할 때 사용할 기준 항목을 정의하는 역할입니다.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const content = reponse.choices[0]?.message?.content;

    console.log(content);

    try {
      const parsed = JSON.parse(content ?? "");

      console.log(parsed);
      return parsed;
    } catch (error) {
      throw new Error();
    }
  }

  private getFeedbackPrompt(question_text: string) {
    return `너는 지금 개발자 면접관이야. 아래 질문을 평가하기 위한 '의도'를 한 문장으로 정의하고, 평가 기준을 '핵심 기준'과 '보조 기준'으로 나눠서 JSON으로 출력해줘.

      - 질문: ${question_text}  

      조건:
      1. 핵심 기준은 이 질문에서 가장 중요하게 평가해야 할 2~3개의 항목이야.
      2. 보조 기준은 답변의 완성도나 추가적인 강점을 평가할 수 있는 1~2개의 항목이야.
      3. 질문의 의도에 따라 평가 기준을 잘 선정해야 해. 질문이 개념 설명과 지식을 요구했는지, 아니면 자신의 경험을 요구했는지에 대해 묻는 질문인지를 잘 구분해서 만들어야 해.
      4. 각 항목은 key는 항목명, value는 설명으로 구성돼야 해.
      5. 결과는 아래 JSON 형식만 따라야 하고, 다른 설명은 절대 포함하지 마.

      형식 예시:
      {
        "의도": "지원자가 JWT 인증의 만료와 갱신 전략을 이해하고 있는지를 평가하기 위한 질문입니다.",
        "핵심_기준": {
          "만료 개념 이해도": "JWT 토큰의 만료 시점 설정과 그 이유를 설명할 수 있는가",
          "갱신 전략 이해도": "리프레시 토큰 등 실제 만료 시 갱신 방식의 장단점을 설명했는가"
        },
        "보조_기준": {
          "실무 경험": "직접 JWT 인증 시스템을 구현한 경험을 간단히 언급했는가",
          "보안 인식": "만료 처리 시 발생할 수 있는 보안 위협을 알고 있는가"
        }
      }
      `;
  }
}
