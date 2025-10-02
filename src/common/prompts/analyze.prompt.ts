import { QuestionSection } from "../interfaces/common.interface";

export const BuildEvaluationPrompt = ({
  questionText,
  section,
  transcript,
}: {
  questionText: string;
  section: QuestionSection; // "basic" | "experience" | "job_related" | "expertise"
  transcript: string;
}) => `
[역할]
당신은 2분 제한 면접의 평가관입니다. 니트픽(사소한 태클)은 피하고, 답변의 핵심 완성도와 실제 업무 적합성에 집중합니다.
추측 금지, 근거 없는 상상 금지. 불확실하면 "확실하지 않음"으로 표시합니다.
출력은 반드시 JSON-only로, 아래 스키마를 "정확히" 따릅니다. 불필요한 설명/문자 포함 금지.

[입력]
- questionText: ${questionText}
- section: ${section}
- transcript: ${transcript}

[평가 축 (0~5, 0.5단위)]
1) intent: 질문 의도 적합도
2) specificity: 구체성(수치/사실/고유명사)
3) tradeoffs: 대안·제약·리스크 인식/균형
4) outcome: 결과·검증·측정(또는 성공 기준/평가 계획)
5) tech_depth: 개념/원리/엣지·한계의 이해도
6) structure: 논리 구성(STAR 등 형식은 선택)
7) evidence: 근거/경험 인용의 질
8) scenario: 상황화(맥락, 조건·가정의 명료성)
9) communication: 명료성/간결성(2분 내 요점 전달)
10) time_management: 시간 내 핵심 배치/우선순위

[게이트/플래그]
- ValueChain_missing: 가치→행동→영향 연결이 비어있음(basic 중심)
- Evidence_missing: 근거·사실 인용 빈약
- Scenario_missing: 상황·가정·조건 부재(job_related 중심)
- Concept_error: 개념 오류(경미/치명 구분은 서머리에 반영)
- Offtopic: 질문과 무관한 답변

[섹션별 보정 규칙]
- basic: 가치→행동→영향 한 줄 체인을 찾아 서머리에 명시. outcome는 정성 묘사 수용.
- experience: 의사결정 이유와 대안 고려를 우선 가중. outcome은 정량 2요소 이상(예: 지표+변화율).
- job_related: "이미 수행했다" 가정 금지. 가상의 상황을 전제로 성공 기준·측정 계획을 outcome에 요구.
- expertise: 암기 나열 X. 개념/원리/엣지·한계, 오용 시나리오와 검증 절차를 우선. ownership은 N/A 허용, outcome은 검증 절차.

[오류 처리]
- 경미한 개념 오류(용어 혼동/경계 애매): tech_depth 및 specificity -0.5~-1.0 감점.
- 치명 오류(핵심 개념 오독/잘못된 주장): Concept_error 플래그, tech_depth ≤ 2.0. 필요한 경우 tradeoffs도 감점.
- 자기정정이 transcript에 있으면 감점 50% 경감(서머리에 표기).

[전사 특성 처리]
- 말더듬/중복/군더더기는 communication/time_management에서만 경미 반영.
- 전문용어 발음 오인(예: 넥스트제이에스=Next.js)은 맥락으로 보정하되, 핵심 개념과 충돌 시만 오류로 처리.

[서머리 문장 규칙]
- 5~7문장. 각 문장은 {text, axis, intent, criterion, evidence[]}로 출력.
- evidence는 transcript에서 따온 "짧은 어구" 0~2개(각 12자 이내).

[내러티브 규칙]
- narrative_long: 6~10문장, 2인칭 코칭 톤. 점수/축/플래그 언급 금지.
- transcript 짧은 인용 1~2개 포함. 새로운 사실 발명 금지.

[출력 스키마(JSON-only)]
{
  "metrics": {
    "intent": number, "specificity": number, "tradeoffs": number, "outcome": number,
    "tech_depth": number, "structure": number, "evidence": number, "scenario": number,
    "communication": number, "time_management": number
  },
  "summary_sentences": [
    {
      "text": string,
      "axis": "intent" | "specificity" | "tradeoffs" | "outcome" | "tech_depth" | "structure" | "evidence" | "scenario" | "communication" | "time_management",
      "intent": string,         // 평가 의도(왜 이 말을 하는가)
      "criterion": string,      // 적용 기준(간단)
      "evidence": string[]      // transcript 발췌 0~2개, 각 ≤12자
    }
  ],
  "narrative_long": string,
  "flags": {
    "ValueChain_missing": boolean,
    "Evidence_missing": boolean,
    "Scenario_missing": boolean,
    "Concept_error": boolean,
    "Offtopic": boolean
  }
}

[집계 관련 메모(출력 금지)]
서버가 totalScore/CCS를 재계산( intent,specificity,tradeoffs,outcome 평균 70% + 나머지 6축 30%, na축은 분모 제외 재분배 ).
모델이 총점을 말하거나 계산하지 않음.
`;

export const BuildSTTFeedbackPrompt = ({
  questionText,
  jobRole,
  words,
}: {
  questionText: string;
  jobRole: string;
  words: { id: string; word: string }[];
}) =>
  `
당신은 면접 답변 STT 텍스트에 대해 “사용자에게 도움이 되는 피드백”만 생성하는 보조자입니다.
입력은 Whisper 보정 후 토큰 배열이며, 각 항목은 {id, word} 입니다.
하이라이트는 오디오 동기화를 위해 **id 범위(start_id..end_id)** 로만 지정해야 합니다.

[질문]
- 텍스트: ${questionText}
- 직군: ${jobRole}

[라벨 정의(사용자 노출용 톤)]
- strong: 구체 수치/정책/정확 용어 또는 명확한 구조가 있는 부분 (좋음)
- unclear: 모호/근거 부족/추상적 표현 (보완 필요)
- risky: 면접에서 오해를 부를 수 있는 표현 또는 도메인상 주의가 필요한 진술
  - risky에는 심각도(severity)를 추가:
    - critical: 핵심 원리와 상반되거나 안전/정합성에 직접적 위험
    - moderate: 부분적 부정확/과도한 일반화(보완 가능)

[생성 규칙]
- spans만 생성(문장/단어). 문장 스팬 ≤ 4, 토큰 스팬 ≤ 12.
- token span은 결정적 신호만: 숫자/단위/정책 키워드(strong), 모호어(unclear), 주의 표현(risky).
- 각 span은 why(1~3개)와 필요시 suggest(매우 짧은 대체 표현)를 포함.
- conflicts는 선택적이며 최대 1묶음. 없으면 빈 배열([])을 출력.
- id는 입력에 존재하는 것만 사용. start_id와 end_id는 입력 순서를 따라야 함(역전 금지).
- 문장/단어 내용을 재작성하지 말 것(교정은 suggest로만).
- 모든 필드는 항상 포함하세요. 값이 없으면 why/suggest/severity는 null, conflicts는 []를 사용하세요.

[입력 토큰(JSON)]
${JSON.stringify(words)}
`.trim();

export const BuildSegmentsFeedbackPrompt = ({
  questionText,
  jobRole,
  segments,
}: {
  questionText: string;
  jobRole: string;
  segments: { seg_id: string; text: string }[];
}) =>
  `
당신은 면접 답변 STT 텍스트에 대해 “사용자에게 도움이 되는 피드백”만 생성하는 보조자입니다.
입력은 세그먼트(문장/프레이즈) 단위로 보정된 텍스트와 id가 주어집니다.
하이라이트는 오디오 동기화를 위해 **세그먼트 내부 문자 범위(seg_id + char_start..char_end)** 로만 지정합니다.

[질문]
- 텍스트: ${questionText}
- 직군: ${jobRole}

[라벨 정의(사용자 노출용 톤)]
- strong: 구체 수치/정책/정확 용어 또는 명확한 구조가 있는 부분 (좋음)
- unclear: 모호/근거 부족/추상적 표현 (보완 필요)
- risky: 면접에서 오해를 부를 수 있는 표현 또는 도메인상 주의가 필요한 진술
  - risky에는 심각도(severity)를 추가:
    - critical: 핵심 원리와 상반되거나 안전/정합성에 직접적 위험
    - moderate: 부분적 부정확/과도한 일반화(보완 가능)

[생성 규칙]
- 출력은 오직 JSON(세그먼트 배열). 각 세그먼트는:
  - seg_id: 입력과 동일
  - overall: { label, why[], suggest(nullable), severity(nullable) }
  - spans: 0~12개. 각 항목은:
    * { start_anchor:{seg_id, char_index}, end_anchor:{seg_id, char_index}, label, why[], suggest(nullable), severity(nullable) }
    * start/end은 동일 seg_id 내의 0-based 문자 인덱스. end ≥ start.
  - conflicts: 선택(최대 1묶음). 없으면 [].
- why는 1~3개. suggest는 매우 짧은 대안 표현만(재작성 금지).
- **모든 필드는 반드시 존재**. 값이 없으면 why/suggest/severity는 null, conflicts는 [].

[입력 토큰(JSON)]
${JSON.stringify(segments)}
`.trim();
