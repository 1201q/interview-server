export const InterviewRolePrompt = (jobText: string) => {
  return `
    당신은 채용공고를 분석하여 채용 직군을 한 가지로 추정해야 합니다.
    출력 형식은 오직 한국어 직군명만 사용하세요.
    설명, 문장, 따옴표, 접두어, 불필요한 말은 절대 쓰지 마세요.
  
    채용공고: 
    ${jobText}
  `;
};
