import { z } from "zod";

export const RubricSchema = z.object({
  id: z.string(),
  intent: z.string().max(300),
  required: z.string().max(250),
  optional: z.string().max(100).nullable(),
  context: z.string().nullable(),
});

export const RubricResponseSchema = z
  .object({
    rubric: z.array(RubricSchema),
  })
  .strict();

export type Rubric = z.infer<typeof RubricSchema>;

export function isRubric(x: unknown): x is Rubric {
  return RubricSchema.safeParse(x).success;
}

export const RubricArraySchema = z.array(RubricSchema);
export function isRubricArray(x: unknown): x is Rubric[] {
  return RubricArraySchema.safeParse(x).success;
}
