import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

// 10개의 평가 축
export const Axis = z.enum([
  "intent",
  "specificity",
  "tradeoffs",
  "outcome",
  "structure",
  "tech_depth",
  "evidence",
  "scenario",
  "time_management",
  "communication",
]);

export const Flag = z.enum([
  "Offtopic",
  "Concept_error",
  "ValueChain_missing",
  "Evidence_missing",
  "Scenario_missing",
]);

// 0~5, 0.5 단위
export const HalfStep = z
  .number()
  .min(0)
  .max(5)
  .refine(
    (v) => Number.isFinite(v) && Math.abs(v * 2 - Math.round(v * 2)) < 1e-9,
    "score must be in 0.5 increments (0 ~ 5)",
  );

export const SummarySentence = z.object({
  text: z.string().min(5).max(240),
  axis: Axis,
  intent: z.string().min(2).max(60),
  criterion: z.string().min(2).max(120),
  evidence: z.array(z.string().min(1).max(12)).max(2).default([]),
});

export const EvaluationSchema = z
  .object({
    metrics: z.object({
      intent: HalfStep,
      specificity: HalfStep,
      tradeoffs: HalfStep,
      outcome: HalfStep,
      reflection: HalfStep,
      tech_depth: HalfStep,
      jd_fit: HalfStep,
      ownership: HalfStep,
      coherence: HalfStep,
      conciseness: HalfStep,
    }),
    summary_sentences: z.array(SummarySentence).min(4).max(7),
    narrative_long: z.string().min(120).max(1200),
    flags: z.object({
      ValueChain_missing: z.boolean(),
      Evidence_missing: z.boolean(),
      Scenario_missing: z.boolean(),
      Concept_error: z.boolean(),
      Offtopic: z.boolean(),
    }),
  })
  .strict();

export const evalJsonSchema = zodTextFormat(
  EvaluationSchema,
  "EvaluationSchema",
);
