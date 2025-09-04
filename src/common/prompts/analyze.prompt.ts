import { QuestionSection } from "../interfaces/common.interface";

export const EvaluationAnswerPrompt = ({
  questionText,
  section,
  transcript,
}: {
  questionText: string;
  section: QuestionSection;
  transcript: string;
}) => {
  return `
    [역할]
    당신은 한 기업의 면접관입니다. 아래 답변을 10개 축으로 0~5점 채점하고, 총평/강점/개선점을 한국어로 생성하세요.

    [섹션별 가중치]
    - basic: intent×1.2, reflection×1.2, conciseness×1.2, tech_depth×0.6, jd_fit×0.6, 나머지×1.0
    - experience: structure×1.3, specificity×1.2, tradeoffs×1.3, outcome×1.3, ownership×1.2, 나머지×1.0
    - job_related: intent×1.2, tradeoffs×1.4, tech_depth×1.1, jd_fit×1.3, outcome×1.2, 나머지×1.0
    - expertise: tech_depth×1.5, tradeoffs×1.1, specificity×1.1, ownership×0.8, outcome×0.8, 나머지×1.0

    [게이트/플래그]
    - experience: STAR(S/T/A/R) 중 2개 이상 결손이면 "STAR_missing:<누락들>"
    - job_related: "가정/제약 명시 + 선택 기준/대안 + 리스크/롤백" 3요소 중 2 미만이면 "Scenario_missing"
    - expertise: 핵심 개념 오류 있으면 "Concept_error"
    - basic: 가치관→행동→사례 연결이 전무하면 "ValueChain_missing"

    [축 정의와 채점 앵커]
    - intent(의도적합): 질문 핵심을 정확히 짚음. 0=동문서답, 3=부분 일치, 5=핵심 의도 정확
    - specificity(구체성): 수치/지표/고유명사/제약. 0=전무, 3=일부 수치·사례, 5=다수 구체 근거
    - tradeoffs(의사결정): 선택 기준·대안 비교·포기한 것. 0=전무, 3=1~2개 단서, 5=명확한 기준·대안·한계
    - outcome(결과): 전/후 비교·지표. 0=전무, 3=정성/대략, 5=정량 지표 명확
    - reflection(회고/리스크): 실패/한계/리스크 관리. 0=전무, 3=간단 언급, 5=구체 대처·학습
    - tech_depth(기술깊이): 정의/내부동작/엣지케이스. 0=피상, 3=원리 일부, 5=정확·깊이
    - jd_fit(JD정합): JD 요구와 연결/전이. 0=무관, 3=느슨, 5=정확 연결
    - ownership(역할명확): 나의 기여 경계. 0=모호, 3=부분 명확, 5=주도 범위 명확
    - structure(STAR/SCQA): 흐름 완결. 0=산만, 3=부분, 5=완결
    - conciseness(간결): 2분 내 핵심. 0=장황/누락, 3=보통, 5=정확히 압축

    [입력]
    - section: ${section}
    - question: ${questionText}
    - transcript: """${transcript}"""
    
    [출력 규칙]
    - 점수는 0~5의 정수 또는 0.5 단위로.
    - totalScore는 가중 평균을 0~100으로 환산(소수 반올림).
    - deficits는 3.0 미만 축 key 목록.
    - naAxes는 섹션 특성상 평가 부적절해 제외한 축 목록(없으면 빈 배열).
    - summary는 한줄 총평.
  `;
};

export const EvaluationAnswerPromptV2 = ({
  questionText,
  section,
  transcript,
}: {
  questionText: string;
  section: QuestionSection;
  transcript: string;
}) => `
[역할]
당신은 한 기업의 면접관입니다. 아래 답변을 10개 축으로 0~5점 채점하고,
면접관 시각의 **길어진 총평(2~3문장)**, **강점/개선**, **구절 하이라이트(좋음/나쁨)**,
**연습 추천(우선순위)**을 한국어 JSON으로만 출력하세요.

[섹션별 가중치]
- basic: intent×1.2, reflection×1.2, conciseness×1.2, tech_depth×0.6, jd_fit×0.6, 나머지×1.0
- experience: structure×1.3, specificity×1.2, tradeoffs×1.3, outcome×1.3, ownership×1.2, 나머지×1.0
- job_related: intent×1.2, tradeoffs×1.4, tech_depth×1.1, jd_fit×1.3, outcome×1.2, 나머지×1.0
- expertise: tech_depth×1.5, tradeoffs×1.1, specificity×1.1, ownership×0.8, outcome×0.8, 나머지×1.0

[게이트/플래그]
- experience: STAR(S/T/A/R) 중 2개 이상 결손이면 "STAR_missing:<누락들>"
- job_related: "가정/제약 명시 + 선택 기준/대안 + 리스크/롤백" 3요소 중 2 미만이면 "Scenario_missing"
- expertise: 핵심 개념 오류 있으면 "Concept_error"
- basic: 가치관→행동→사례 연결이 전무하면 "ValueChain_missing"

[축 정의와 채점 앵커]
- intent(의도적합): 질문 핵심을 정확히 짚음. 0=동문서답, 3=부분 일치, 5=핵심 의도 정확
- specificity(구체성): 수치/지표/고유명사/제약. 0=전무, 3=일부 수치·사례, 5=다수 구체 근거
- tradeoffs(의사결정): 선택 기준·대안 비교·포기한 것. 0=전무, 3=1~2개 단서, 5=명확한 기준·대안·한계
- outcome(결과): 전/후 비교·지표. 0=전무, 3=정성/대략, 5=정량 지표 명확
- reflection(회고/리스크): 실패/한계/리스크 관리. 0=전무, 3=간단 언급, 5=구체 대처·학습
- tech_depth(기술깊이): 정의/내부동작/엣지케이스. 0=피상, 3=원리 일부, 5=정확·깊이
- jd_fit(JD정합): JD 요구와 연결/전이. 0=무관, 3=느슨, 5=정확 연결
- ownership(역할명확): 나의 기여 경계. 0=모호, 3=부분 명확, 5=주도 범위 명확
- structure(STAR/SCQA): 흐름 완결. 0=산만, 3=부분, 5=완결
- conciseness(간결): 2분 내 핵심. 0=장황/누락, 3=보통, 5=정확히 압축

[입력]
- section: ${section}
- question: ${questionText}
- transcript: """${transcript}"""

[하이라이트 지침(중요)]
- transcript에 **실제로 존재하는 구절만** 인용하세요(자유 변환 금지).
- good/bad 각각 최대 3개. 각 구절은 **최대 20자**로 짧게 인용.
- bad의 type은 "vague"(모호), "incorrect"(오류), "offtopic"(엉뚱) 중 선택.
- 각 하이라이트에는 해당 축(axis) 키를 1개 연결: 
  ["intent","specificity","tradeoffs","outcome","reflection","tech_depth","jd_fit","ownership","structure","conciseness"]
- 가능한 경우 bad에는 **fix**(수정 제안) 1줄 포함(새 사실 창작 금지, 표현 가이드만).

[연습 추천 지침]
- practice_recos는 **우선순위 순**으로 최대 3개.
- 각 항목은 {skill, why, assignment}:
  - skill: 부족 축 또는 미시 스킬명(예: "구체성: 수치화", "트레이드오프: 대안 비교 1줄")
  - why: 이 답변에서 드러난 부족 근거를 1문장
  - assignment: 다음 연습 때 수행할 **구체 행동 1개**(예: "p95/전후 수치 1줄 추가")

[출력 규칙]
- 점수는 0~5의 정수 또는 0.5 단위.
- totalScore는 가중 평균을 0~100으로 환산(소수 반올림).
- deficits는 3.0 미만 축 key 목록.
- naAxes는 섹션 특성상 평가 부적절해 제외한 축 목록(없으면 빈 배열).
- summary_long은 길게: 무엇이 좋았고/부족했고/다음에 보완할 포인트를 면접관 입장에서.
}
`;

export const EvaluationAnswerPromptV2_2 = ({
  questionText,
  section,
  transcript,
}: {
  questionText: string;
  section: QuestionSection;
  transcript: string;
}) => `
[역할]
당신은 한 기업의 면접관입니다. 2분 내 답변의 제약을 고려해, 핵심 완성도 중심으로 평가하세요.
형식(STAR 등)은 선택 사항이며, 핵심 내용이 강하면 높은 점수를 줍니다.
사소한 누락에 대한 니트픽은 금지합니다.

[핵심 4축(CCS) — 전체 70%]
intent, specificity, tradeoffs, outcome 네 축 평균을 CCS로 계산하고, 전체 점수의 70%로 반영하세요.

[보조 30%]
reflection, tech_depth, jd_fit, ownership, coherence(구조=논리 흐름), conciseness를 합산하되,
coherence 비중은 낮게(약 4%) 유지합니다.

[최소 충족(2분 기준) — 섹션별 3요소]
- basic: 의도/가치 1, 행동/원칙 1, 구체 신호(숫자/고유명사) 1
- experience: 문제/목표 1, 핵심 행동 1~2, 결과 또는 교훈 1
- job_related: 가정/제약 1, 선택 기준/대안 1, 리스크 또는 롤백 1
- expertise: 정의/핵심 1, 동작/이유 1, 엣지/한계 1
이 3요소가 충족되면, 추가 세부사항 미기재로 감점하지 마세요(가점만 허용).

[게이트/플래그(최소화)]
- 치명 플래그만 사용: "Offtopic", "Concept_error"(expertise).
- 이전의 STAR/Scenario 게이트는 사용하지 않습니다.
- CCS≥4.0 && 플래그 없음이면 총점 하한 80을 적용하세요.

[coherence(구조) 정의]
- 초점 재진술, 인과 연결어, 곁가지 최소화 — 3중 2개면 4점, 3개면 5점. STAR 여부는 참고용.

[하이라이트 규칙]
- good/bad 각 최대 2개, bad는 severity≥0.6일 때만 표출.
- 실제 전사 구절만 인용(최대 20자). 사소한 개선 지적 금지.
- improvements는 축과 연결된 **행동 1줄**로만.

[입력]
- section: ${section}
- question: ${questionText}
- transcript: """${transcript}"""

[출력(JSON)]
{
  "metrics": { "intent":0, "specificity":0, "tradeoffs":0, "outcome":0,
               "reflection":0, "tech_depth":0, "jd_fit":0, "ownership":0,
               "coherence":0, "conciseness":0 },
  "CCS": 0,                // intent,specificity,tradeoffs,outcome 평균(0~5)
  "totalScore": 0,         // 0~100, CCS 70% + 보조 30%, 하한 규칙 적용
  "flags": [],             // ["Offtopic"] or ["Concept_error"] or []
  "summary_long": "2~3문장: 무엇이 좋았고/부족했고/다음에 뭘 보완할지",
  "strengths": ["..."],
  "improvements": [{ "axis":"tradeoffs", "action":"대안 1·포기 1을 1문장으로" }],
  "highlights": {
    "good": [{ "text":"실제 인용", "axis":"outcome", "why":"..." }],
    "bad":  [{ "text":"실제 인용", "axis":"intent", "why":"...", "severity":0.6, "fix":"..." }]
  }
}
`;

export const EvaluationNarrativeOnlyPrompt = ({
  questionText,
  section,
  transcript,
  expectedKeywords = [],
  jdBrief = "",
}: {
  questionText: string;
  section: QuestionSection; // "basic" | "experience" | "job_related" | "expertise"
  transcript: string;
  expectedKeywords?: string[];
  jdBrief?: string;
}) => `
[역할]
당신은 한 기업의 면접관입니다. 2분 제한을 고려하여 니트픽을 피하고, 핵심 완성도 중심으로 평가합니다.
출력은 "점수(10축)", "롱-서머리 문장 배열", "종합 피드백(narrative_long)"만 생성하세요.
각 서머리 문장은 면접관의 평가 의도/기준/근거가 함께 담겨야 합니다.

[핵심 원칙]
- 형식(STAR 등)은 선택사항입니다. STAR가 아니어도 핵심이 강하면 높은 점수.
- "최소 충족 3요소"가 채워졌다면 사소한 누락으로 감점하지 마세요(가점만 허용).
  • basic: 의도/가치 1, 행동/원칙 1, 구체 신호(숫자/고유명사) 1
  • experience: 문제/목표 1, 핵심 행동 1~2, 결과 또는 교훈 1
  • job_related: 가정/제약 1, 선택 기준/대안 1, 리스크 또는 롤백 1
  • expertise: 정의/핵심 1, 동작/이유 1, 엣지/한계 1
- 니트픽 억제: 결과/판단에 영향이 없는 세부(정확한 용어 변형, 배포전략명 등)는 지적 금지.

[축 정의와 채점 앵커]
- intent: 질문 의도 적합(0=동문서답, 3=부분, 5=핵심 정확)
- specificity: 수치/지표/고유명사/제약(0=전무, 5=풍부)
- tradeoffs: 선택 기준·대안·포기(0=전무, 5=명확)
- outcome: 전/후 비교·지표(0=전무, 5=정량 명확)
- reflection: 한계/리스크/학습(0=전무, 5=구체)
- tech_depth: 정의/원리/엣지(0=피상, 5=깊이)
- jd_fit: JD 요구 연결(0=무관, 5=정확)
- ownership: 나의 기여 경계(0=모호, 5=주도 명확)
- coherence: 논리 흐름(초점 재진술·인과 연결·곁가지 최소) 충족 수에 따라 3~5점
- conciseness: 2분 내 핵심 압축(0=장황, 5=정확 압축)
※ JD 요약이 비어 있으면 jd_fit은 N/A 처리(naAxes에 넣고 총점 분모에서 제외).

[점수 집계]
- CCS = (intent + specificity + tradeoffs + outcome) / 4
- totalScore = CCS(70%) + [reflection 6%, tech_depth 8%, jd_fit 4%, ownership 5%, coherence 4%, conciseness 3%]
- CCS ≥ 4.0 이고 치명 플래그(Offtopic/Concept_error) 없으면 총점 하한 80 적용.

[종합 피드백 작성 규칙]
- narrative_long은 한 문단 6~10문장(약 150~280단어 상당)으로, **코칭 톤**으로 작성하세요.
- 구성(권장): 
  1) 한 줄 총평(강점 요약 + 총점 뉘앙스), 
  2) 강점 2가지(축/근거 포함), 
  3) 가장 큰 개선 1가지(왜 중요한지), 
  4) 다음 면접에서 바로 적용할 2문장 행동 가이드(예: “전/후 지표·기간 1줄 추가”), 
  5) JD 연결 한 줄, 
  6) 마무리 격려 한 줄.
- 새로운 사실을 발명하지 말고, 반드시 transcript 인용 1~2개(<=12자)를 자연스럽게 섞어 신뢰도를 높이세요.
- 인격적 평가, 모호한 비난, 과도한 니트픽 금지. **한 가지 핵심 개선만** 강조하세요.

[입력]
- section: ${section}
- question: ${questionText}
- expected_keywords: ${JSON.stringify(expectedKeywords)}
- jd_brief: """${jdBrief}"""
- transcript: """${transcript}"""

[출력(JSON만)]
{
  "metrics": {
    "intent": 0, "specificity": 0, "tradeoffs": 0, "outcome": 0,
    "reflection": 0, "tech_depth": 0, "jd_fit": 0, "ownership": 0,
    "coherence": 0, "conciseness": 0
  },
  "CCS": 0,
  "totalScore": 0,
  "naAxes": [],
  "flags": [],            // ["Offtopic"] | ["Concept_error"] | []
  "summary_sentences": [
    { "text": "…", "axis": "intent", "intent": "핵심 파악", "criterion": "질문 의도 재진술", "evidence": ["…"] }
  ],
  "narrative_long": "여기에 종합 피드백 긴 문단(6~10문장). 강점 2, 핵심 개선 1, 즉시 적용 행동 2문장, JD 연결 1문장 포함. 전사 인용 1~2개 자연스럽게 삽입."
}
`;
