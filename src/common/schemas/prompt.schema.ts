import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

const QuestionItem = z.object({
  text: z.string(),
  based_on: z.string(),
  section: z.enum(["basic", "experience", "job_related", "expertise"]),
});

const QuestionSchema = z.object({
  questions: z.array(QuestionItem).length(10),
});

export const generatedQuestionFormat = zodTextFormat(
  QuestionSchema,
  "generatedQuestionFormat",
);
