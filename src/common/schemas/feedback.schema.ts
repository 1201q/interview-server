import { z } from "zod";

export const FeedbackSchema = z
  .object({
    one_line: z.string(),
    feedback: z.string(),
    misconception: z
      .object({
        summary: z.string(),
        explanation: z.string(),
        evidence: z.string(),
      })
      .nullable(),
  })
  .strict();

export type Feedback = z.infer<typeof FeedbackSchema>;

export function isFeedback(x: unknown): x is Feedback {
  return FeedbackSchema.safeParse(x).success;
}
