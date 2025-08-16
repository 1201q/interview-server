import "dotenv/config";
import { execSync } from "child_process";
import OpenAI from "openai";

// 마지막 커밋의 diff만 추출 (메타데이터 제외)
const diff = execSync("git diff --cached --no-color", {
  encoding: "utf-8",
});

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const res = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "user",
      content: `너는 Git 커밋 메시지 작성기야.
다음 Git diff를 보고 반드시 아래 규칙을 따라 메시지를 작성해.

- 제목: Gitmoji + Conventional Commit 타입 + 한국어 요약 (50자 이내)
- 타입은 feat, fix, chore, docs, style, refactor, test, perf 중 하나만 선택
- 두 번째 줄은 비워둬야 함
- 세 번째 줄 이후는 bullet point로 상세 변경 내용
- 절대로 백틱(\`)이나 코드블록(\`\`\`)을 쓰지 말고, 메시지 텍스트만 출력해.

${diff}`,
    },
  ],
  temperature: 0.3,
});

// 그냥 메시지만 출력
console.log(res.choices[0].message.content.trim());
