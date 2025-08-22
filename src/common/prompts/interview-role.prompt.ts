export const InterviewRolePrompt = (jobText: string) => {
  return `
    역할: 채용공고를 보고 이 채용공고가 어떤 직군을 모집하는지를 추정하세요. 한국어로 직군 이름만 짧게.
  
    채용공고: ${jobText}
  `;
};
