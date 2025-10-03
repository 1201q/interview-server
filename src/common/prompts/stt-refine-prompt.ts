import { STTRefineSegmentsDto } from "src/analysis/analysis.dto";

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
