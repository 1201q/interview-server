import { z } from "zod";
import { zodResponseFormat, zodTextFormat } from "openai/helpers/zod";

// questions
export const PushQuestionSchema = z.object({
  index: z.number().int().min(1).max(20),
  text: z.string(),
  based_on: z.string(),
  section: z.enum(["basic", "experience", "job_related", "expertise"]),
  section_index: z.number().int().min(1).max(7),
});

export const FlatQuestionsSchema = z.object({
  items: z.array(PushQuestionSchema).length(20),
});

export const QuestionItem = z.object({
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

export const generatedQuestionResponseFormat = zodResponseFormat(
  QuestionItem,
  "generatedQuestionResponseFormat",
);

//

export const KeywordsForSttItemSchema = z.object({
  id: z.string(),
  stt_keywords: z.array(z.string()).min(5).max(20).default([]),
});

export const KeywordsForSttDtoSchema = z.object({
  keywords: z.array(KeywordsForSttItemSchema).default([]),
});

export const sttKeywordFormat = zodTextFormat(
  KeywordsForSttDtoSchema,
  "sttKeywordSchema",
);

export type KeywordsForSttItemDto = z.infer<typeof KeywordsForSttItemSchema>;
export type KeywordsForSttDto = z.infer<typeof KeywordsForSttDtoSchema>;
