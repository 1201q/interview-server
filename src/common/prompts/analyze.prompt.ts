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
