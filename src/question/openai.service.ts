import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { GenerateQuestionType } from "src/common/interfaces/common.interface";
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
      - 질문 키워드, 주제: ${topic}  

      조건:
      1. 생성되는 질문은 ${jobRole} 포지션에 맞게 기술 수준을 적절히 조절할 것.
      2. "${question_type}" 유형의 질문에 맞게 구성할 것.
        - 개념 설명형(concept): 개념의 정의, 작동 원리, 목적 등을 묻는 질문
        - 비교 설명형(comparison): 두 기술 간의 차이점, 장단점, 선택 기준 등을 묻는 질문
        - 시스템 설계형(system_design): 시스템 구조, 아키텍처 설계, 고려사항 등을 묻는 질문
        - 구현 문제형(implementation): 로직 설명을 요구하되 **코드가 아닌 말로 설명 가능한 수준의 문제**
        - 경험/상황형(experience): 과거 경험이나 특정 상황에서의 대처 방식을 묻는 질문
      3. 각 질문은 명확하고 실제 면접에서 활용할 수 있어야 함.
      4. 코드 작성 요구는 하지 말 것.
      5. **출력은 반드시 아래 JSON 포맷을 따를 것.**

      형식 예시:
      {
        "questions": [
          { "id": 1, "question_text": "JWT와 세션의 차이점을 설명해주세요." },
          { "id": 2, "question_text": "JWT를 사용하면서 겪을 수 있는 보안 이슈는 어떤 것이 있을까요?" },
          ...
        ]
      }

      이제 면접 질문 10개를 생성해줘.`;
  }
}
