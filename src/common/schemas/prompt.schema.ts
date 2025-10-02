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

export const makeQuestionSchema = (len: number) =>
  z.object({
    questions: z.array(QuestionItem).length(len),
  });

const QuestionSchema = z.object({
  questions: z.array(QuestionItem).length(12),
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

export const RefinedItemZ = (len: number) =>
  z
    .object({
      refined_words: z
        .array(
          z
            .string()
            .min(1, "빈 문자열 금지")
            .max(100, "토큰이 너무 깁니다")
            .refine((s) => !/```|^```|^~~~|~~~/.test(s), "코드블록 금지")
            .refine((s) => !/[\n\r]/.test(s), "개행 금지"),
        )
        .length(len, "단어 개수 유지"),
    })
    .strict();

export const RefinedSegmentItemZ = (len: number) =>
  z
    .object({
      refined_segments: z
        .array(
          z
            .string()
            .refine((s) => !/```|^```|^~~~|~~~/.test(s), "코드블록 금지")
            .refine((s) => !/[\n\r]/.test(s), "개행 금지"),
        )
        .length(len, "seg 개수 유지"),
    })
    .strict();
