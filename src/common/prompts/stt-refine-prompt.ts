import { STTRefineDto, STTRefineSegmentsDto } from "src/analysis/analysis.dto";

export const BuildSttRefinePrompt = ({
  questionText,
  jobRole,
  words,
}: STTRefineDto) => {
  const lines: string[] = [];

  lines.push(
    `당신은 면접에 참가한 지원자를 평가하는 AI 면접 답변 평가 시스템입니다.`,
  );

  if (questionText) {
    lines.push(`\n답변한 질문:\n${questionText}`);
  }
  if (jobRole) {
    lines.push(
      `- 이 질문에 ${jobRole} 직군의 지원자가 답변했습니다. 단어를 보정할 때, 해당 직군의 지원자가 면접 상황에서 많이 사용할만한 전문 단어를 위주로 보정해보세요. 특히 영어전문 단어요.`,
    );
  }

  lines.push(
    `
아래는 질문에 대한 지원자의 발화로부터 Whisper STT가 추출한 단어 리스트입니다.
문장의 흐름과 질문의 의도에 맞게 맞춤법이 틀렸거나, 필사가 틀린 단어만 보정하세요.
해당 단어 리스트는 오디오 재생과 동기화되어 하이라이트에 사용됩니다.

조건:
1) 적절한 위치에 쉼표(,)나 마침표(.)를 삽입, 구두점은 앞 단어 꼬리에만 붙임(., ,).
2) 기술 용어는 정확 표기 (예: Figma, Excel, async, Promise, import 등)
3) 중요. **한국어로 잘못 발음/철자된 기술 용어는 원래 영문 표기나 통용 표기로 복원**
4) 단어 **순서 유지**
5) 단어 **개수 유지** (새 단어나 문장 금지, 구두점만 보정)
6) 마크다운 코드 블록 금지
7) 출력은 **입력과 동일한 길이의 문자열 배열**만
8) 영단어를 합치지 말 것 ("useEffect" 같은 단어도 "use", "Effect"처럼 끊어서 유지)
9) 출력 배열 길이가 입력과 다르면 실패입니다. 절대 성공으로 간주하지 마세요.

👇 반드시 아래 형식의 JSON 배열만 출력 (설명/코드블록/따옴표 장식 금지), **입력배열과 출력배열의 길이는 반드시 동일해야함.** 
형식 예시: ["HTML,", "CSS,", "렌더링합니다."]

입력 단어:
${JSON.stringify(words.map((w) => w.word))}
`.trim(),
  );

  return lines.join("\n");
};

export const BuildSttRefinePromptV2 = ({
  questionText,
  jobRole,
  words,
}: {
  questionText?: string;
  jobRole?: string;
  words: { id: string; word: string }[];
}) => {
  const lines: string[] = [];

  lines.push(
    `당신은 면접에 참가한 지원자를 평가하는 AI 면접 답변 평가 시스템입니다.`,
  );

  if (questionText) {
    lines.push(`\n답변한 질문:\n${questionText}`);
  }
  if (jobRole) {
    lines.push(
      `- 이 질문에 ${jobRole} 직군의 지원자가 답변했습니다. 단어를 보정할 때, 해당 직군의 지원자가 면접 상황에서 많이 사용할만한 전문 단어를 위주로 보정해보세요.`,
    );
  }

  lines.push(
    `
아래는 질문에 대한 지원자의 발화로부터 Whisper STT가 추출한 단어 리스트입니다.
문장의 흐름과 질문의 의도에 맞게 맞춤법이 틀렸거나, 필사가 틀린 단어만 보정하세요.
해당 단어 리스트는 오디오 재생과 동기화되어 하이라이트에 사용됩니다.

입력은 Whisper 추출 단어 리스트입니다(오디오와 동기화). **각 항목은 {id, word}** 입니다.
- 단어 순서 유지, 단어 개수 유지, **id는 입력과 동일** (재배열/누락/추가 금지)

조건:
1) 적절한 위치에 쉼표(,)나 마침표(.)를 삽입
2) 기술 용어는 정확 표기 (예: Figma, Excel, async, Promise, import 등)
3) 중요. **한국어로 잘못 발음/철자된 기술 용어는 원래 영문 표기나 통용 표기로 복원**
4) 단어 **순서 유지**
5) 단어 **개수 유지** (새 단어나 문장 금지, 구두점만 보정)
6) 마크다운 코드 블록 금지
7) 출력은 **입력과 동일한 길이의 문자열 배열**만
8) 영단어를 합치지 말 것 ("useEffect" 같은 단어도 "use", "Effect"처럼 끊어서 유지)
9) 출력 배열 길이가 입력과 다르면 실패입니다. 절대 성공으로 간주하지 마세요.
10) **id는 입력과 100% 동일**해야 합니다. id가 다르면 실패입니다.

👇 반드시 아래 형식의 JSON 배열만 출력 (설명/코드블록/따옴표 장식 금지)
[{"id":"w-0","word":"..."},{"id":"w-1","word":"..."}]

입력 단어:
${JSON.stringify(words)}
`.trim(),
  );

  return lines.join("\n");
};

export const BuildSttRefinePromptV3 = ({
  questionText,
  jobRole,
  words,
}: STTRefineDto) => {
  const lines: string[] = [];

  lines.push(
    `당신은 STT(Whisper) 단어를 **자리/개수/토큰화 그대로** 유지하면서,
오탈자, 기술용어, 그리고 적절한 위치에 구두점을 보정하는 AI 편집기입니다.`,
  );

  if (questionText) {
    lines.push(`\n질문:\n${questionText}`);
  }
  if (jobRole) {
    lines.push(
      `- 이 질문에 ${jobRole} 직군의 지원자가 답변했습니다. 해당 직군에서 많이 쓰는 **영문 기술용어**는 원 표기(예: async, Promise, TTL, Figma, Excel 등)를 사용하세요.`,
    );
  }

  lines.push(
    `
[핵심 규칙]
1) **인덱스 i 입력 토큰 → 인덱스 i 출력 토큰** (1:1 대응, 순서/개수 고정, 분할/병합 금지)
2) 구두점도 보정 대상: 적절한 위치에 쉼표(,)나 마침표(.)를 삽입, 구두점은 앞 단어 꼬리에만 붙임(., ,).
3) 기술용어는 영문 통용 표기로 복원 (예: 프로미스→Promise, 레이턴시→latency, 피그마→Figma)
4) 코드블록/설명/메타텍스트 출력 금지

[토큰화 고정 예시]
- 입력: ["유즈", "이펙트를"]  → 출력: {"refined_words":["use","Effect를"]}
  (입력이 2토큰이면 **반드시 2토큰 유지**. 각 토큰 안에서만 보정)
- 입력: ["유즈이펙트는"]      → 출력: {"refined_words":["useEffect는"]}
  (입력이 1토큰이면 **반드시 1토큰 유지**. 합치거나 쪼개지 않음)

[출력 형식 (반드시 아래 JSON 한 줄만)]
{"refined_words":["토큰0","토큰1",...]}  // 입력과 **길이 동일**

[입력 배열(JSON)]
${JSON.stringify(words.map((w) => w.word))}
`.trim(),
  );

  return lines.join("\n");
};

export const BuildSttRefinePromptV4 = ({
  questionText,
  jobRole,
  words,
}: STTRefineDto) => {
  const lines: string[] = [];

  lines.push(
    `당신은 STT(Whisper) 단어를 **자리/개수/토큰화 그대로** 유지하면서,
오탈자, 기술용어, 그리고 적절한 위치에 구두점을 보정하는 AI 편집기입니다.`,
  );

  if (questionText) {
    lines.push(`\n질문:\n${questionText}`);
  }
  if (jobRole) {
    lines.push(
      `- 이 질문에 ${jobRole} 직군의 지원자가 답변했습니다. 해당 직군에서 많이 쓰는 **영문 기술용어**는 원 표기(예: async, Promise, TTL, Figma, Excel 등)를 사용하세요.`,
    );
  }

  lines.push(
    `

[안티-드리프트 규칙]
- **인덱스 i 입력 토큰 → 인덱스 i 출력 토큰**(1:1). **순서/개수/토큰 경계** 절대 변경 금지(분할·병합·재배열 금지).
- **확신이 낮으면** 해당 토큰은 **원문 그대로 유지**합니다(오버-보정 금지).
- 절대 새로운 공백을 만들지 말고, 입력 토큰 내부의 공백/하이픈/언더스코어 유무를 그대로 따릅니다.

[영단어/조사 처리 규칙]
- **영단어 때문에 밀림 금지**: 입력이 한 토큰이면 출력도 반드시 한 토큰입니다.
  - 예) 입력: ["유즈이펙트는"] → 출력: {"refined_words":["useEffect는"]}
- **영단어+조사 결합은 한 토큰 안에서만 보정**:
  - 예) ["이펙트를"] → ["Effect를"], ["티티엘은"] → ["TTL은"]
- 입력이 두 토큰이면 출력도 두 토큰:
  - 예) ["유즈","이펙트를"] → ["use","Effect를"], ["피그","마를"] → ["Fig","ma를"]

[구두점 규칙(강제)]
- 문장 끝에는 **반드시 마침표(.)**를 붙입니다.
- 절/호흡이 끊기는 접속부에는 **쉼표(,)** 를 붙입니다.
- 구두점은 **항상 앞 단어 꼬리**에만 붙입니다(예: "먼저," / "중요했습니다.").
- 구두점을 붙이지 않으면 **출력은 실패로 간주**됩니다.

[금지]
- 코드블록/설명/메타텍스트 출력 금지. 개행·백틱·트리플백틱·따옴표 장식 금지.
- 숫자/단위 표기는 맥락상 확실한 경우에만 보정(e.g., "히트미스" → "히트/미스" 허용).

[토큰화 고정 예시]
- 입력: ["유즈", "이펙트를"]  → 출력: {"refined_words":["use","Effect를"]}
  (입력이 2토큰이면 **반드시 2토큰 유지**. 각 토큰 안에서만 보정)
- 입력: ["유즈이펙트는"]      → 출력: {"refined_words":["useEffect는"]}
  (입력이 1토큰이면 **반드시 1토큰 유지**. 합치거나 쪼개지 않음)

[셀프체크(반드시 수행)]
- 출력 직전에 다음을 스스로 검증하고, 하나라도 어기면 **원본 토큰을 그대로 사용**하여 길이/경계 일치를 맞추세요:
  1) 출력 배열 길이 == 입력 배열 길이
  2) 각 토큰에 개행/백틱/코드블록/설명 없음
  3) 입력 토큰에 없던 공백/하이픈/언더스코어를 새로 만들지 않음
  4) 문장 마지막 토큰에 마침표가 붙었는지 확인
  5) 영단어 때문에 밀림이 없는지 반드시 확인

[출력 형식 (반드시 아래 JSON 한 줄만)]
{"refined_words":["토큰0","토큰1",...]}  // 입력과 **길이 동일**

[입력 배열(JSON)]
${JSON.stringify(words.map((w) => w.word))}
`.trim(),
  );

  return lines.join("\n");
};

// segments
export const BuildRefineSegmentsPrompt = ({
  questionText,
  jobRole,
  segments,
}: STTRefineSegmentsDto) => {
  const lines: string[] = [];

  lines.push(
    `당신은 입력받은 STT(Whisper) sements의 텍스트를 최대한 유지하면서,
오탈자나 특히 기술용어를 위주로 보정하는 AI 편집기입니다.`,
  );

  if (questionText) {
    lines.push(`\n질문:\n${questionText}`);
  }
  if (jobRole) {
    lines.push(
      `- 이 질문에 ${jobRole} 직군의 지원자가 답변했습니다. 해당 직군에서 많이 쓰는 **영문 기술용어**를 생각해보세요.`,
    );
  }

  lines.push(
    `
[핵심 규칙]
1) 원문을 보존하면서, 오탈자, 기술용어만 보정하세요.
    - 새로운 단어나 문장은 만들지 마세요.
    - 단어 순서나 개수를 바꾸지 마세요.
    - segment의 경계(분할)도 바꾸지 마세요.
    - 기술 용어는 한국어로 영단어의 발음이 표기된 케이스만 영문 통용 표기로 복원하세요. 확신이 없으면 원문 유지. 해당 직군의 기술 용어가 아닌 일상어는 원문을 유지.
2) 각 segment의 텍스트는 오디오 재생과 동기화되어 하이라이트에 사용됩니다.
3) 출력은 **입력과 동일한 길이의 문자열 배열**만
4) 코드블록/설명/메타텍스트 출력 금지

[출력 형식 (반드시 아래 JSON 한 줄만)]
{"refined_segments":["segment1","segment2",...]}  // 입력과 **길이 동일**

[입력 배열(JSON)]
${JSON.stringify(segments.map((s) => s.text))}
`.trim(),
  );

  return lines.join("\n");
};
