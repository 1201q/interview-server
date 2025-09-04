import { z } from "zod";
import { zodResponseFormat, zodTextFormat } from "openai/helpers/zod";

// 10개의 평가 축
export const EvalAxisEnum = z.enum([
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

/** good/bad 하이라이트 공통 */
const HighlightBase = z.object({
  text: z.string().min(1).max(20), // 실제 전사 텍스트
  axis: EvalAxisEnum,
  why: z.string().min(3).max(200), // 이유?
});

const GoodHighlight = HighlightBase;
const BadHighlight = HighlightBase.extend({
  type: z.enum(["vague", "incorrect", "offtopic"]),
  fix: z.string().min(3).max(200).nullable(), // 수정 가이드 (있을 수도?)
});

/** 연습 추천  */
const PracticeReco = z.object({
  skill: z.string().min(2).max(50),
  why: z.string().min(5).max(200),
  assignment: z.string().min(5).max(200),
});

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

// 평가 스키마
export const EvalV2Schema = z.object({
  metrics: z.object({
    intent: HalfStep,
    specificity: HalfStep,
    tradeoffs: HalfStep,
    outcome: HalfStep,
    reflection: HalfStep,
    tech_depth: HalfStep,
    jd_fit: HalfStep,
    ownership: HalfStep,
    structure: HalfStep,
    conciseness: HalfStep,
  }),
  totalScore: z
    .number()
    .min(0)
    .max(100)
    .transform((v) => Math.round(v)),
  gatedFlags: z.array(z.string()).default([]),
  naAxes: z.array(EvalAxisEnum).default([]),
  deficits: z.array(EvalAxisEnum).default([]), // // 3.0 미만 축
  summary_long: z.string().min(200).max(500),
  strengths: z.array(z.string().min(3)).min(2).max(3),
  improvements: z.array(z.string().min(3)).min(2).max(3),

  highlights: z.object({
    good: z.array(GoodHighlight).max(3).default([]),
    bad: z.array(BadHighlight).max(3).default([]),
  }),

  practice_recos: z.array(PracticeReco).max(3).default([]),
});

export const evalV2Format = zodTextFormat(EvalV2Schema, "evalV2Format");
