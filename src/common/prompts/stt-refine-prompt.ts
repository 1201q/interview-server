import { STTRefineDto } from "src/analyze/analyze.dto";

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
      `- 이 질문에 ${jobRole} 직군의 지원자가 답변했습니다. 단어를 보정할 때, 해당 직군의 지원자가 면접 상황에서 많이 사용할만한 전문 단어를 위주로 보정해보세요.`,
    );
  }

  lines.push(
    `
아래는 질문에 대한 지원자의 발화로부터 Whisper STT가 추출한 단어 리스트입니다.
문장의 흐름과 질문의 의도에 맞게 맞춤법이 틀렸거나, 필사가 틀린 단어만 보정하세요.
해당 단어 리스트는 오디오 재생과 동기화되어 하이라이트에 사용됩니다.

조건:
1) 적절한 위치에 쉼표(,)나 마침표(.)를 삽입
2) 기술 용어는 정확 표기 (예: Figma, Excel, async, Promise, import 등)
3) 중요. **한국어로 잘못 발음/철자된 기술 용어는 원래 영문 표기나 통용 표기로 복원**
4) 단어 **순서 유지**
5) 단어 **개수 유지** (새 단어나 문장 금지, 구두점만 보정)
6) 마크다운 코드 블록 금지
7) 출력은 **입력과 동일한 길이의 문자열 배열**만
8) 영단어를 합치지 말 것 ("useEffect" 같은 단어도 "use", "Effect"처럼 끊어서 유지)

👇 반드시 아래 형식의 JSON 배열만 출력 (설명/코드블록/따옴표 장식 금지), **입력배열과 출력배열의 길이는 반드시 동일해야함.** 
형식 예시: ["HTML,", "CSS,", "렌더링합니다."]

입력 단어:
${JSON.stringify(words)}
`.trim(),
  );

  return lines.join("\n");
};
