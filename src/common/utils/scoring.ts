type Metrics = {
  intent?: number;
  specificity?: number;
  tradeoffs?: number;
  outcome?: number;
  tech_depth?: number;
  structure?: number;
  evidence?: number;
  scenario?: number;
  communication?: number;
  time_management?: number;
};

type Flags = {
  ValueChain_missing: boolean;
  Evidence_missing: boolean;
  Scenario_missing: boolean;
  Concept_error: boolean;
  Offtopic: boolean;
};

export const computeScores = (metrics: Metrics, flags: Flags) => {
  if (flags.Concept_error && typeof metrics.tech_depth === "number") {
    metrics.tech_depth = Math.min(metrics.tech_depth, 2.0);
  }

  const core = ["intent", "specificity", "tradeoffs", "outcome"] as const;
  const supp = [
    "tech_depth",
    "structure",
    "evidence",
    "scenario",
    "communication",
    "time_management",
  ] as const;

  const coreVals = core
    .map((k) => metrics[k])
    .filter((v): v is number => typeof v === "number");

  const suppVals = supp
    .map((k) => metrics[k])
    .filter((v): v is number => typeof v === "number");

  const mean = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN;

  const coreMean = mean(coreVals);
  const suppMean = mean(suppVals);

  let wCore = 0.7;
  let wSupp = 0.3;

  if (!coreVals.length && suppVals.length) {
    wCore = 0.0;
    wSupp = 1.0;
  }
  if (!suppVals.length && coreVals.length) {
    wCore = 1.0;
    wSupp = 0.0;
  }

  const CCS_raw =
    (isNaN(coreMean) ? 0 : wCore * coreMean) +
    (isNaN(suppMean) ? 0 : wSupp * suppMean);

  let ccs = flags.Offtopic ? Math.min(CCS_raw, 2.0) : CCS_raw;

  // 0~100으로 변환
  let total = Math.round(ccs * 20);

  if (ccs >= 4.0 && !flags.Concept_error && !flags.Offtopic) {
    total = Math.max(total, 80);
  }

  ccs = Math.round(ccs * 10) / 10;

  return { ccs, total };
};
