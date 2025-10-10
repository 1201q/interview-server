// ---------- Zod Schema (optional runtime validation) ----------
import { z } from "zod";

export const IntervalSchema = z.object({
  s: z.number(),
  e: z.number(),
});

export const VoiceDiagSchema = z.object({
  drops: z.object({
    context: z.number(),
    energy_valley: z.number(),
    low_prob: z.number(),
    too_short_long: z.number(),
    vad: z.number(),
  }),
  gain_db: z.number(),
  post_nms_kept: z.number(),
  pre_nms_candidates: z.number(),
  segmentation_mode: z.string(), // 'adaptive' | 'fixed' 등 자유 문자열
  total_windows: z.number(),
});

export const VoiceFluencySchema = z.object({
  fillers_per_min: z.number(),
});

export const VoiceIntervalsSchema = z.object({
  filler: z.array(IntervalSchema),
  silence: z.array(IntervalSchema),
  speech: z.array(IntervalSchema),
  speech_wo_filler: z.array(IntervalSchema),
});

export const PauseHygieneSchema = z.object({
  avg_phrase_sec: z.number(),
  long_pauses_count: z.number(),
  long_pauses_per_min: z.number(),
  longest_pause_ms: z.number(),
  pause_distribution: z.object({
    head: z.number(),
    body: z.number(),
    tail: z.number(),
  }),
  phrase_len_sd: z.number(),
});

export const VoiceRatiosSchema = z.object({
  filler_ratio: z.number(),
  silence_per_duration: z.number(),
  silence_per_speech: z.number(),
  silence_plus_filler_per_speech_wo_filler: z.number(),
  speech_density: z.number(),
});

export const VoiceJsonSchema = z
  .object({
    diag: VoiceDiagSchema,
    duration_ms: z.number(),
    filler_ms: z.number(),
    fluency: VoiceFluencySchema,
    intervals: VoiceIntervalsSchema,
    pause_hygiene: PauseHygieneSchema,
    ratios: VoiceRatiosSchema,
    silence_ms: z.number(),
    speech_ms: z.number(),
    speech_wo_filler_ms: z.number(),
  })
  .strict();

export type VoiceJson = z.infer<typeof VoiceJsonSchema>;

export function isVoiceJson(x: unknown): x is VoiceJson {
  return VoiceJsonSchema.safeParse(x).success;
}
