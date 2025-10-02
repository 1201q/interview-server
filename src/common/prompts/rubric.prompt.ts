import { GenerateRubricDto, RubricDto } from "@/analysis/analysis.dto";

export const BuildRubricPrompt = (dto: RubricDto) => {
  return `
당신은 기업 면접관입니다. 주어진 질문텍스트, 그리고 파일 서치로 가져온 컨텍스트(이력서/채용공고 관련 챙크)를 근거로
이 질문에 대한 맞춤형 평가 기준(Rubric)을 생성하세요.

[중요]
- 내부적으로는 단계별로 철저히 검토하되(의도 파악→증거 매핑→축 도출→가중치),
  **사고 과정은 출력하지 말고**, 오직 최종 JSON만 출력하라.

[입력]
- 질문 전문(question_full):
- 답변 제한 시간: 2분(120초)

[생성 절차(내부적으로 수행하되 출력 금지)]
1) 채용공고(JD)에서 해당 공고의 모집직군과 요구 역량을 도출하고, 질문과의 직접 관련도를 판단한다.
2) 이력서/채용공고 챙크를 근거로, **이 질문이 어떤 맥락에서 출제되었는지** 정리한다.
3) 질문이 **요구하는 핵심 요소**(2분 내 반드시 나와야 하는 것)를 식별한다.
4) 이 질문이 **어떤 역량을 검증**하려는지 정의한다(지식/경험/의사결정/성과 등).
5) 위 근거를 바탕으로 평가 축(axis) 3~6개를 도출하고, 축별 가중치(weight)와 유형(type)을 정한다.
  - type: core(필수) | bonus(가산) | optional(거의 영향 없음)
  - 가중치 규칙: core 합≥0.60, optional 합≤0.10, 전체 합=1.00
6) 각 축에 대해 0/3/5 앵커를 작성하되, 답변의 **2분 제한시간을 반영**한다
  - 0: 핵심 결여/오해
  - 3: 부분 충족/모호 (핵심은 있으나 정량·근거나 구조 약함)
  - 5: 2분 내 핵심을 구체적·정량적·근거 기반으로 명확히 제시
7) 증거 연결: 축별로 이력서나 채용공고의 어떤 부분을 참고해 판단했는지 인용. 적합한 근거가 없으면 null.

[출력 형식(반드시 JSON만 출력; 모든 필드 포함, 없으면 null/[])]
{
  "interviewer_intent": string,  // 면접관이 이 질문으로 확인하려는 정보(2~4문장, 요약형)
  "question_context": string,    // 이 질문이 이력서/JD 맥락에서 왜 나왔는지(근거 개요)
  "axes": [
    {
      "name": string,            // 축 이름(간결)
      "definition": string,      // 무엇을 평가하는지
      "anchors": { "0": string, "3": string, "5": string },
      "weight": number,          // 0~1(소수점 둘째자리), 전체 합=1
      "type": "core" | "bonus" | "optional",
      "rationale": string,       // 이 축을 넣은 이유(질문/직군/컨텍스트와의 연결)
      "evidence_support": string | null // 이 축 평가에 참고한 이력서/JD 근거(없으면 null)
    }
  ],
  "expected_evidence": string[], // 답변에 있으면 좋은 지표/정책/키워드 3~5개
  "red_flags": string[],         // 감점 패턴 3~5개(사실오류, 범위 이탈, 근거 부재 등)
  "followup_hooks": string[]     // 꼬리질문 포인트 1~3개(질문 의도 범위 내)
}
  `.trim();
};

export const BuildRubricPromptV2 = (dto: RubricDto) => {
  return `
[역할]
당신은 기업 면접관이다. 질문과 직군을 보고, File Search로 이력서/채용공고에서 스스로 근거를 검색한 뒤
2분 답변을 평가할 **맞춤 Rubric**을 생성한다. 내부 추론은 출력하지 말고 **JSON만** 출력하라.

[입력]
- question_full: 
- answer_time_limit: 120초

[File Search 사용 규칙]
- 각 컬렉션에서 **최대 3개**(합계 ≤ 6)만 사용.
- 원문/본문(excerpt)을 출력하지 말고, **메타데이터만** 결과에 포함:
  { id: "resume:xxx:chunkNN" | "jd:yyy:chunkMM", source_type: "resume"|"jd", sim: 0..1(소수 둘째), kw: 키워드 최대 5개 }
- 같은 문서에서 인접한 결과는 **하나로 병합**하여 대표 id만 사용.
- 근거가 약하면 “근거 신뢰도 낮음”을 명시.

[Rubric 생성 규칙]
- 축(axis)은 **3~4개**.
- 각 축에는 다음 필드를 반드시 포함:
  - name: 축 이름(간결)
  - definition: 무엇을 평가하는지(질문 의도와 연결)
  - anchors: 0/3/5 **각 1문장**, 2분 제한 반영
    * 0 = 핵심 결여/오해
    * 3 = 부분 충족/모호(핵심은 있으나 정량·근거나 구조 약함)
    * 5 = 2분 내 핵심을 구체·정량·근거 기반으로 명확히 전달
  - weight: 0~1(소수 둘째). **전체 합=1.00**
  - type: "core" | "bonus" | "optional"
  - rationale: **160자 이내**(필요 시 evidence id 인용)
  - evidence_ids: 검색 메타의 id 배열(없으면 빈 배열[])
- 가중치 제약: **core 합 ≥ 0.60**, **optional 합 ≤ 0.10**, 전체 합 = **1.00**
- 범위 준수: 질문이 직접 요구하지 않는 확장은 **optional** 또는 **red_flags**로 처리.

[출력 형식(반드시 JSON만; 모든 필드 필수, 없으면 [] 또는 null)]
{
  "interviewer_intent": string,           // 2문장 이내
  "retrieved_meta": [                     // File Search 결과 메타(본문 금지)
    { "id": string, "source_type": "resume"|"jd", "sim": number, "kw": string[] }
  ],
  "axes": [
    {
      "name": string,
      "definition": string,
      "anchors": { "0": string, "3": string, "5": string },
      "weight": number,
      "type": "core" | "bonus" | "optional",
      "rationale": string,                // ≤160자
      "evidence_ids": string[]            // retrieved_meta.id 참조
    }
  ],
  "expected_evidence": string[],          // 최대 3개
  "red_flags": string[],                  // 최대 3개
  "followup_hooks": string[]              // 최대 1개
}
`.trim();
};

export const BuildRubricUserPrompt = (dto: RubricDto) => {
  const array = dto.questionList.map((q, index) => ({
    id: `q${index + 1}`,
    text: q,
  }));

  const arrayStr = array
    .map((item) => `  { id: "${item.id}", text: "${item.text}" }`)
    .join(",\n");

  return `
[역할]
당신은 기업 면접관입니다. 질문 목록(id, text)을 보고, File Search로 이력서/채용공고에서 스스로 근거를 검색해
각 답변(2분 제한)을 평가할 맞춤 Rubric을 생성하세요. 내부 추론은 출력하지 말고 JSON만 출력하세요.

[입력]
- question_list: [${arrayStr}]

[File Search 사용 규칙]
1. File Search의 호출 횟수는 최대 8번입니다. (이력서, 채용공고 합산)
2. 일단 질문을 처음부터 끝까지 차근차근 읽어보세요.
3. 질문을 모두 읽었다면 8번의 호출 제한을 고려하여 어떻게 효율적으로 파일을 검색할지 계획을 세우세요.
4. 파일 검색이 필요하다고 판단되면, File Search를 호출하세요.

[지침]
1. 질문의 **핵심 의도**를 파악하고 질문이 요구하는 내용을 도출하세요.
2. 질문이 어떤 맥락에서 출제되었는지, **이력서/채용공고에서 어떤 부분을 참고해 판단했는지** 정리하세요.
3. **질문이 요구하는 핵심 요소(2분 내 반드시 나와야 하는 것)와 부가적 요소(답변 시간을 고려할 때 등장하면 가산점)를 식별하세요.**
4. 질문이 어떤 역량을 검증하려는지 정의하세요(지식/경험/의사결정/성과 등).
5. 위 근거를 바탕으로 **면접관의 입장에서** 텍스트를 작성하세요.
  - 면접관의 질문 의도는 intent에 3~4문장으로. (핵심 의도, 맥락, 검증 역량 포함)
  - 면접관이 중점적으로 볼 것/검증할 것은 required. (2분 내 답변에 반드시 포함되어야 하는 것)
  - 면접관이 추가로 알고 싶거나 2분 제한을 고려할 때 답변에 있으면 좋은 것은 optional.

[출력 JSON 스키마]
{
  "rubric": [
    {
      "id": 질문 id,
      "intent": string (3~4문장),
      "required": 필수 요소 2~3문장,
      "optional": 1~2문장 또는 null,
      "context": (이력서 or 채용공고에서 이 질문 의도와 관련된 맥락을 간결하게. 없다면 null),
    }, 
    ...
  ]
`.trim();
};

export const BuildRubricUserPromptV2 = (dto: RubricDto) => {
  const array = dto.questionList.map((q, index) => ({
    id: `q${index + 1}`,
    text: q,
  }));

  const arrayStr = array
    .map((item) => `  { id: "${item.id}", text: "${item.text}" }`)
    .join(",\n");

  return `
[역할]
당신은 기업 면접관입니다. 질문 목록(id, text)을 보고, File Search로 이력서/채용공고에서 스스로 근거를 검색해
각 답변(2분 제한)을 평가할 맞춤 Rubric을 생성하세요. 내부 추론은 출력하지 말고 JSON만 출력하세요.

[입력]
- question_list: [${arrayStr}]

[File Search 사용 규칙]
1. File Search의 호출 횟수는 최대 8번입니다. (이력서, 채용공고 합산)
2. 일단 질문을 처음부터 끝까지 차근차근 읽어보세요.
3. 질문을 모두 읽었다면 8번의 호출 제한을 고려하여 어떻게 효율적으로 파일을 검색할지 계획을 세우세요.
4. 파일 검색이 필요하다고 판단되면, File Search를 호출하세요.

[지침]
1. 질문의 **핵심 의도**를 파악하고 질문이 요구하는 내용을 도출하세요.
2. 질문이 어떤 맥락에서 출제되었는지, **이력서/채용공고에서 어떤 부분을 참고해 판단했는지** 정리하세요.
3. **질문이 요구하는 핵심 요소(2분 내 반드시 나와야 하는 것)와 부가적 요소(답변 시간을 고려할 때 등장하면 가산점)를 식별하세요.**
4. 질문이 어떤 역량을 검증하려는지 정의하세요(지식/경험/의사결정/성과 등).
5. 위 근거를 바탕으로 **면접관의 입장에서** 텍스트를 작성하세요.
  - 면접관의 질문 의도는 intent에 3~4문장으로. (핵심 의도, 맥락, 검증 역량 포함)
  - 면접관이 중점적으로 볼 것/검증할 것은 required. (2분 내 답변에 반드시 포함되어야 하는 것)
  - 면접관이 추가로 알고 싶거나 2분 제한을 고려할 때 답변에 있으면 좋은 것은 optional.
6. 문장은 정중한 말투로 작성하세요.

[출력 요소]
- id: 질문 id
- intent: string (3~4문장)
- required: 필수 요소 2~3문장
- optional: 1~2문장 또는 null,
- context: (이력서 or 채용공고에서 이 질문 의도와 관련된 맥락을 간결하게. 없다면 null)
`.trim();
};

export const BuildRubricUserPromptV3 = (dto: GenerateRubricDto) => {
  const arrayStr = dto.questionList
    .map((item) => `  { id: "${item.id}", text: "${item.text}" }`)
    .join(",\n");

  return `
[역할]
당신은 기업 면접관입니다. 질문 목록(id, text)을 보고, File Search로 이력서/채용공고에서 스스로 근거를 검색해
각 답변(2분 제한)을 평가할 맞춤 Rubric을 생성하세요. 내부 추론은 출력하지 말고 JSON만 출력하세요.

[입력]
- question_list: [${arrayStr}]

[File Search 사용 규칙]
1. File Search의 호출 횟수는 최대 8번입니다. (이력서, 채용공고 합산)
2. 일단 질문을 처음부터 끝까지 차근차근 읽어보세요.
3. 질문을 모두 읽었다면 8번의 호출 제한을 고려하여 어떻게 효율적으로 파일을 검색할지 계획을 세우세요.
4. 파일 검색이 필요하다고 판단되면, File Search를 호출하세요.

[지침]
1. 질문의 **핵심 의도**를 파악하고 질문이 요구하는 내용을 도출하세요.
2. 질문이 어떤 맥락에서 출제되었는지, **이력서/채용공고에서 어떤 부분을 참고해 판단했는지** 정리하세요.
3. **질문이 요구하는 핵심 요소(2분 내 반드시 나와야 하는 것)와 부가적 요소(답변 시간을 고려할 때 등장하면 가산점)를 식별하세요.**
4. 질문이 어떤 역량을 검증하려는지 정의하세요(지식/경험/의사결정/성과 등).
5. 위 근거를 바탕으로 **면접관의 입장에서** 텍스트를 작성하세요.
  - 면접관의 질문 의도는 intent에 3~4문장으로. (핵심 의도, 맥락, 검증 역량 포함)
  - 면접관이 중점적으로 볼 것/검증할 것은 required. (2분 내 답변에 반드시 포함되어야 하는 것)
  - 면접관이 추가로 알고 싶거나 2분 제한을 고려할 때 답변에 있으면 좋은 것은 optional.
6. 문장은 정중한 말투로 작성하세요.

[출력 요소]
- id: 질문 id, 입력 id와 동일해야함
- intent: string (3~4문장)
- required: 필수 요소 2~3문장
- optional: 1~2문장 또는 null,
- context: (이력서 or 채용공고에서 이 질문 의도와 관련된 맥락을 간결하게. 없다면 null)
`.trim();
};
