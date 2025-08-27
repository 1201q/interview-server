export const SttBiasPrompt = (params: {
  keywords: string[];
  jobRole?: string;
  questionText?: string;
  prevTail?: string;
}) => {
  const main: string[] = ["[상황: 실시간으로 면접 질문에 답변하는 상황]"];
  if (params.jobRole) main.push(`[직군 힌트: ${params.jobRole}]`);
  if (params.questionText) main.push(`[답변중인 질문: ${params.questionText}]`);
  if (params.prevTail) main.push(`[직전 문장 꼬리: ${params.prevTail}]`);

  const joinedMain = main.join(" ") + " ";
  const joinedKeywords = "[예상 단어: " + params.keywords.join(", ") + "]";

  const finalText = (joinedMain + joinedKeywords).slice(0, 900);

  return finalText;
};
