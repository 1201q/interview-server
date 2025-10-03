import { z } from "zod";

export const QuestionItem = z.object({
  text: z.string(),
  based_on: z.string(),
  section: z.enum(["basic", "experience", "job_related", "expertise"]),
});

export const makeQuestionSchema = (len: number) =>
  z.object({
    questions: z.array(QuestionItem).length(len),
  });

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
