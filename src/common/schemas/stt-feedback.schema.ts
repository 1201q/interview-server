import { z } from "zod";

const Label = z.enum(["strong", "unclear", "risky"]);
const Severity = z.enum(["critical", "moderate"]);

const Anchor = z.object({
  seg_id: z.string(),
  char_index: z.number().int().min(0),
});

const SpanSchema = z.object({
  start_anchor: Anchor,
  end_anchor: Anchor,
  label: Label,
  why: z.array(z.string()).nullable(),
  suggest: z.string().nullable(),
  severity: Severity.nullable(),
});

export const SegmentFeedbackSchema = z.object({
  seg_id: z.string(),
  overall: z.object({
    label: Label,
    why: z.array(z.string()).nullable(),
    suggest: z.string().nullable(),
    severity: Severity.nullable(),
  }),
  spans: z.array(SpanSchema),
  conflicts: z.array(
    z.object({
      reason: z.string(),
      refs: z.array(z.string()),
    }),
  ),
});

export const FeedbackSegSchema = z.object({
  feedback_segments: z.array(SegmentFeedbackSchema),
});
