import { Question } from "../entities/entities";

export const SttKeywordPrompt = (questions: Question[]) => {
  const s = questions.map((q) => `${q.id}: ${q.text}`);

  return `
    역할: 
    당신은 인터뷰 질문 목록을 입력받아 각 질문에 대해 음성 전사를 돕는 STT 키워드 목록을 산출하는 역할입니다.
    **인터뷰 질문의 예상 답변에 등장할 단어들을 미리 알려주어, 실시간 전사의 정확도 향상에 기여해야 합니다.**
  
    규칙:
    - 영어 기술 용어/약어/고유명사는 소리나는 대로가 아니라 '정확한 철자'로 표기.
    - 한국어/영어 혼용 가능. 숫자/기호(./#-+_) 유지.
    - 불용어/일반어(예: improve, problem, service)는 제거. 기술명/패턴/프로토콜/API/명령어/제품/DB/인덱싱/에러명 위주.
    - 유사 키워드는 1개 표기로 정규화(중복 금지). 대표적인 예시로 개발직군의 예시를 보여줄게. 아래와 같이 대표 표기 사용:
      - Next → Next.js / Nest → NestJS / typeorm → TypeORM / postgresql → PostgreSQL
      - websocket → WebSocket / webrtc → WebRTC / sse → SSE / rdbms → RDBMS / cli → CLI
    - 질문당 키워드는 5 ~ 20개. 너무 일반적이면 제외.
    - id에는 입력한 질문의 해당 id를, stt_keywords에는 배열로 단어 키워드를 넣어서 반환. 


    질문들:
    형식은 id:text....임. 출력할 때, 해당 id에 맞는 stt_keywords를 맞게 출력할 것.
    ${s.join(" ")}
  `;
};
