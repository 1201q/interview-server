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
  questions: z.array(QuestionItem).length(20),
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

// 평가 스키마
export const EvalSchema = z.object({
  metrics: z.object({
    intent: z.number().min(0).max(5),
    specificity: z.number().min(0).max(5),
    tradeoffs: z.number().min(0).max(5),
    outcome: z.number().min(0).max(5),
    reflection: z.number().min(0).max(5),
    tech_depth: z.number().min(0).max(5),
    jd_fit: z.number().min(0).max(5),
    ownership: z.number().min(0).max(5),
    structure: z.number().min(0).max(5),
    conciseness: z.number().min(0).max(5),
  }),
  totalScore: z.number().min(0).max(100),
  gatedFlags: z.array(z.string()),
  naAxes: z
    .array(
      z.enum([
        "intent",
        "specificity",
        "tradeoffs",
        "outcome",
        "reflection",
        "tech_depth",
        "jd_fit",
        "ownership",
        "structure",
        "conciseness",
      ]),
    )
    .default([]),
  deficits: z
    .array(
      z.enum([
        "intent",
        "specificity",
        "tradeoffs",
        "outcome",
        "reflection",
        "tech_depth",
        "jd_fit",
        "ownership",
        "structure",
        "conciseness",
      ]),
    )
    .default([]),
  summary: z.string().min(5),
  strengths: z.array(z.string()).min(2),
  improvements: z.array(z.string()).min(2),
});

export const evalFormat = zodTextFormat(EvalSchema, "evalFormat");
