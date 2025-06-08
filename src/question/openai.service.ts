import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import * as clarinet from "clarinet";

import { GenerateQuestionFromGptDto } from "./dtos/generate-question.dto";
import { GenerateQuestionFromResumeResult } from "src/common/interfaces/common.interface";

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
    });

    const content = response.choices[0]?.message?.content;

    try {
      const parsed: { questions: GenerateQuestionFromResumeResult } =
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
    당신은 이력서와 채용공고를 기반으로 면접 질문을 생성하는 면접관입니다.

    다음 이력서와 채용공고를 참고하여 총 30개의 면접 질문을 JSON 형식으로 생성해주세요.  
    각 질문마다 반드시 이 질문이 이력서 또는 채용공고의 어떤 내용을 기반으로 작성되었는지를 설명하는 **"based_on"** 필드를 포함해야 합니다. 
    출력은 반드시 **순수 JSON** 형식으로만 반환하세요. 마크다운, 주석, 설명 없이 JSON만 출력해주세요.

    [이력서]
    ${resume}

    [채용공고]
    ${recruitment}

    [요청사항]
    질문은 총 4개 섹션으로 나누어 주세요:

    I. basic (기본 질문) - 3개  
    - 예: 자기소개, 지원 동기, 장단점 등

    II. experience (이력 및 경험 기반 질문) - 9개  
    - 이력서 기반, 경험/성과/프로젝트에 대해 질문
    - 실제 상황 질문 (예: STAR 기법 유도)

    III. job_related (직무 관련 질문) - 11개  
    - 해당 직무에서 자주 마주치는 문제 또는 역할 기반 질문
    - 이력서 및 채용공고 기반으로 생성

    IV. expertise (전문 지식 질문) - 7개  
    - 이력서에서 언급된 도구, 개념, 이론 등에 대한 깊이 있는 질문

    - 질문 30개를 4개 카테고리로 나누어 생성해주세요.
    - 아래 JSON 형식만 반환하세요. 마크다운 코드블록 없이 출력해주세요.
    {
        "questions": {
        "experience": [
            {
                "question": "Redis를 활용한 동시성 문제 해결 경험에 대해 자세히 설명해 주세요.",
                "based_on": "이력서 상에서 'Redis를 활용하여 세션 동기화 및 잠금 처리 구현'한 경험을 언급하셨습니다."
            },
            {
                "question": "CI/CD 구축 경험에 대해 설명해 주시고, GitHub Actions를 사용한 이유는 무엇인가요?",
                "based_on": "이력서에 'GitHub Actions 기반 CI/CD 파이프라인 구축 및 자동 배포 구현'이라고 명시되어 있습니다."
            }
            ],
        ...
        }
    }`;
  }
}
