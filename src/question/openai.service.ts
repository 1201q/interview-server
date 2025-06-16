import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import * as clarinet from "clarinet";

import { GenerateQuestionFromGptDto } from "./dtos/generate-question.dto";
import { GeneratedQuestionFromResumeResult } from "src/common/interfaces/common.interface";

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

  async generateFeedbackStandard(
    questions: { question_text: string; question_id: string }[],
  ) {
    const prompt = this.getFeedbackStandardPrompt(questions);

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
      const parsed = JSON.parse(content ?? "");

      console.log(parsed);
      return parsed;
    } catch (error) {
      console.log(error);
      throw new Error();
    }
  }

  private getFeedbackStandardPrompt(
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

  // 이력서 기반 질문 생성
  async streamQuestionsFromResume(
    resume: string,
    recruitment: string,
    onSection: (section: string, data: any[]) => void,
  ) {
    const prompt_text = this.getGenerateQuestionFromResumePrompt(
      resume,
      recruitment,
    );

    const stream = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "당신은 어떤 직군이든 면접 질문을 만들어낼 수 있는 전문 면접관입니다.",
        },
        { role: "user", content: prompt_text },
      ],
      temperature: 0.7,
      stream: true,
    });

    let currentSection: string | null = null;
    let currentArray: any[] = [];
    let insideQuestions = false;

    const parser = clarinet.createStream();

    parser.on("key", (key) => {
      if (key === "questions") insideQuestions = true;
      else if (
        insideQuestions &&
        ["basic", "experience", "job_related", "expertise"].includes(key)
      ) {
        currentSection = key;
        currentArray = [];
      }
    });

    parser.on("value", (val) => {
      if (currentSection) currentArray.push(val);
    });

    parser.on("closearray", () => {
      if (currentSection) {
        onSection(currentSection, currentArray);
        currentSection = null;
        currentArray = [];
      }
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;

      console.log(delta);
      if (delta) {
        parser.write(delta);
      }
    }

    parser.end();
  }

  async generateQuestionsFromResume(resume: string, recruitment: string) {
    const prompt_text = this.getGenerateQuestionFromResumePrompt(
      resume,
      recruitment,
    );

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
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
      const parsed: { questions: GeneratedQuestionFromResumeResult[] } =
        JSON.parse(content ?? "");

      return parsed;
    } catch (error) {
      console.log(error);
      throw new Error();
    }
  }

  private getGenerateQuestionFromResumePrompt(
    resume: string,
    recruitment: string,
  ) {
    return `
    당신은 한 기업의 면접관입니다. 현재 총 400명의 지원자 중 단 1명을 선발해야 합니다.

    당신의 목표는 단순히 기술이나 지식에 대해 알고 있는지 여부가 아닌, **실제 문제 해결 능력**, **상황 대처 능력**, **팀 협업 역량** 등을 종합적으로 평가하는 질문을 설계하는 것입니다.
    다음 이력서와 채용공고를 바탕으로 다음 조건에 따라 총 20개의 질문을 JSON 형식으로 생성하세요:

    [이력서]
    ${resume}

    [채용공고]
    ${recruitment}

    [요청사항]
    1. 질문은 아래 4개 섹션으로 나누어 생성하세요:
    - **basic** (기본 질문) – 3개  
        단순 자기소개가 아닌, 가치관, 행동 양식, 동기 등을 파악할 수 있는 질문 포함

    - **experience** (이력 기반) – 6개  
        단순 "설명해보세요"가 아니라, 왜 그렇게 했는가, 실패한 경험은 없는가 등  
        → STAR 기법 (Situation, Task, Action, Result)을 유도하는 방식 권장
        → 이력서의 특정 경험(관련 대회 출전, 팀 프로젝트 경험, 사이드 프로젝트나 포트폴리오의 이름이 언급되었다면 해당 이름을 포함)을 세부적으로 검증하는 질문 포함

    - **job_related** (직무 기반) – 4개  
        → 채용공고의 업무 내용과 이력서의 경험을 기반으로 실제 업무 상황을 가정한 질문 구성
        → 이력서에 채용공고와 부합하는 부분이나 비슷한 경험이 있다면, 콕 찝어서 언급
        → 채용공고에서 요구하는 능력을 검증하기 위해 이력서에서의 경험들을 검증하세요.
        → 질문은 반드시 이력서 또는 채용공고 내의 직접적인 문구 또는 유추 가능한 업무 내용에 근거해야 합니다.

    - **expertise** (전문 기술 기반) – 7개  
        기술/도구/이론에 대해 깊이 있는 이해를 유도하는 질문 구성 

    2. 모든 질문은 다음 기준 중 최소 하나를 반영해야 합니다:
        - 비슷한 경험을 가진 다른 지원자와의 차별성을 확인할 수 있는 질문
        - 의사결정의 이유 또는 실패 경험과 회고를 요구하는 질문
        - 실제 업무와 유사한 복잡한 상황을 가정한 문제 해결형 질문
        - 해당 지원자가 깊은 기술 이해도를 가지고 있는지를 검증할 설명을 유도하는 질문
        - 후속 질문(follow-up question)을 할 수 있도록 충분한 여지를 남겨야 함

    3. 아래 JSON과 같은 형식으로 반환하세요. 마크다운 코드블록 없이 출력해주세요.
    {
        "questions": [
            {
                "question": "지원자에게 건넬 질문 내용",
                "based_on": "해당 질문이 이력서 또는 채용공고의 어떠한 내용을 근거로 생성되었는지 설명하세요. 이력서라면 이력서, 채용공고라면 채용공고라는 단어를 꼭 포함하세요. ",
                "section" : "4가지 섹션 중 하나"
            } ...
        ]
    }

    ❌ 다음과 같은 일반적인 질문은 생성하지 마세요:
    - 협업이 왜 중요하다고 생각하나요?
    - 소통의 중요성은 무엇인가요?
    - 본인의 장단점은 무엇인가요?

    이와 같은 질문은 지원자의 경험을 평가하기 어렵기 때문에 
    경험을 검증하는 질문은, 반드시 특정한 이력서 혹은 채용공고의 표현을 기반으로 경험을 검증하는 질문만 생성하세요.

    위 내용을 참고하여 총 20개의 질문을 생성하세요.`;
  }
}
