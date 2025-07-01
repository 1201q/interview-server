import { PromptTemplate } from "@langchain/core/prompts";

export const followUpPrompt = PromptTemplate.fromTemplate(
  `
  당신은 면접관입니다. 아래는 지원자의 현재 질문과 답변입니다:

  질문: {original_question}  
  답변: {current_answer}

  이전 질문과 답변 기록:
  {qa_history}

  이와 관련된 이력서 및 채용공고의 요약된 문맥입니다:
  {retrieved_context}

  만약 답변이 충분하고 구체적이라면 follow-up 질문을 하지 마세요. 아래 JSON 형식으로 응답하세요:

  {{ "result": "SKIP" }}

  하지만 답변이 모호하거나 더 깊이 파악할 필요가 있다면 follow-up 질문을 아래 형식으로 생성하세요:

  {{ "result": "FOLLOW_UP", "question": "..." }}
  `,
);
