from pathlib import Path
import re
import pandas as pd
import math

# ---------- 경로 ----------
BASE = Path(__file__).parent
SCORES_CSV = BASE / "scores.csv"
COACHING_CSV = BASE / "coaching.csv"
OUT_MERGED = BASE / "merged_report_softsnr.csv"
OUT_SCORES = BASE / "scores_reweighted.csv"

# ---------- 정규식 ----------
SNR_RE = re.compile(r"SNR\s+([0-9]+(?:\.[0-9]+)?)\s*dB", re.IGNORECASE)
UPSPEAK_RE = re.compile(r"업스픽\s+([0-9]+(?:\.[0-9]+)?)\s*%")


def read_csv_smart(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, encoding="utf-8-sig")
    df.columns = df.columns.str.strip().str.lower()
    return df


# ---------- SNR 소프트 페널티(최종 0~100에 감점) ----------
def snr_penalty_db(x):
    if x is None:
        return 0.0
    if x >= 12:
        return 0.0
    if x >= 8:
        return (x - 12) * (0 - (-3)) / (12 - 8) + 0
    if x >= 5:
        return (x - 8) * (-15 - (-8)) / (5 - 8) + (-8)
    return -15.0


# ---------- 가중치 (0~5 척도 → 0~100 환산 전 가중평균) ----------
W = {
    "s_articulation_clarity": 0.17,
    "s_pace_control": 0.18,
    "s_intonation_range": 0.15,
    "s_audio_hygiene": 0.12,
    "s_fluency": 0.10,
    "s_pause_hygiene": 0.10,
    "s_volume_stability": 0.08,
    "s_confidence_tone": 0.04,
    "s_filler_control": 0.03,
    "s_breath_control": 0.03,
}
W = {k.lower(): v for k, v in W.items()}
S_METRICS = list(W.keys())


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def get_snr_from_tips(row: pd.Series):
    for k in ("tip1", "tip2", "tip3"):
        t = row.get(k)
        if pd.isna(t):
            continue
        m = SNR_RE.search(str(t))
        if m:
            try:
                return float(m.group(1))
            except:
                pass
    return None


def get_upspeak_from_tips(row: pd.Series):
    for k in ("tip1", "tip2", "tip3"):
        t = row.get(k)
        if pd.isna(t):
            continue
        m = UPSPEAK_RE.search(str(t))
        if m:
            try:
                return float(m.group(1))
            except:
                pass
    return None


# --------- [신규] 결측치 임퓨테이션 ----------
def impute_submetrics_if_missing(row: pd.Series) -> pd.Series:
    """모든 s_*가 결측이면 coaching의 SNR/업스픽%로 보수적으로 채움."""
    present = sum(0 if pd.isna(row.get(k)) else 1 for k in S_METRICS)
    if present > 0:
        return row  # 일부라도 있으면 그대로 사용

    snr = row.get("snr_db")
    ups = row.get("upspeak_pct")

    # 기본값(중립 3.0~3.5 근처). 음성들 “문제 없음” 전제 → 너무 낮게 깎지 않음.
    defaults = {
        "s_articulation_clarity": 3.5,
        "s_pace_control": 3.5,
        "s_intonation_range": 3.2,
        "s_audio_hygiene": 3.0,
        "s_fluency": 3.5,
        "s_pause_hygiene": 3.2,
        "s_volume_stability": 3.2,
        "s_confidence_tone": 3.6,
        "s_filler_control": 3.6,
        "s_breath_control": 3.2,
    }

    # SNR → audio_hygiene 보정(12dB=3.5, 10dB=3.2, 8dB=3.0, 5dB=2.5, 1dB=2.0)
    if snr is not None:
        if snr >= 12:
            ah = 3.5
        elif snr >= 10:
            ah = 3.2 + (snr - 10) * (3.5 - 3.2) / (12 - 10)
        elif snr >= 8:
            ah = 3.0 + (snr - 8) * (3.2 - 3.0) / (10 - 8)
        elif snr >= 5:
            ah = 2.5 + (snr - 5) * (3.0 - 2.5) / (8 - 5)
        else:
            ah = 2.0 + (snr - 1) * (2.5 - 2.0) / (5 - 1) if snr >= 1 else 2.0
        defaults["s_audio_hygiene"] = clamp(round(ah, 2), 0, 5)

    # 업스픽% → confidence_tone/intonation_range 보정 (업스픽 높으면 confidence↓)
    if ups is not None:
        # 0% → +0.0, 80% → -1.8 정도 (선형)
        conf = defaults["s_confidence_tone"] - (ups * 0.0225)
        defaults["s_confidence_tone"] = clamp(round(conf, 2), 0, 5)
        # 업스픽이 매우 높으면 intonation_range도 살짝 하향
        into = defaults["s_intonation_range"] - (ups * 0.01)
        defaults["s_intonation_range"] = clamp(round(into, 2), 0, 5)

    for k, v in defaults.items():
        row[k] = v
    return row


def weighted_vqs(row: pd.Series):
    num = den = 0.0
    for k, w in W.items():
        v = row.get(k)
        if pd.isna(v):
            continue
        try:
            num += float(v) * w
            den += w
        except:
            pass
    if den == 0:
        return None
    return round((num / den) * 20, 1)  # 0~100


# ---------- 로드&머지 ----------
scores = read_csv_smart(SCORES_CSV)
coaching = read_csv_smart(COACHING_CSV)

if "file_id" not in scores.columns:
    raise KeyError(f"[scores.csv] 'file_id' 없음. 현재 컬럼: {list(scores.columns)}")
if "file_id" not in coaching.columns:
    raise KeyError(
        f"[coaching.csv] 'file_id' 없음. 현재 컬럼: {list(coaching.columns)}"
    )

merged = pd.merge(scores, coaching, on="file_id", how="outer")

# 코칭에서 SNR/업스픽 추출
merged["snr_db"] = merged.apply(get_snr_from_tips, axis=1)
merged["upspeak_pct"] = merged.apply(get_upspeak_from_tips, axis=1)

# [핵심] s_* 전부 결측인 행은 임퓨테이션으로 채우기
merged = merged.apply(impute_submetrics_if_missing, axis=1)

# vqs 후보 자동 탐색
VQS_CANDIDATES = ["vqs", "vqs_raw", "voice_quality_score", "voice_qs"]
vqs_key = next((c for c in VQS_CANDIDATES if c in merged.columns), None)


def compute(row: pd.Series):
    # 1) 기존 vqs 있으면 사용, 없으면 가중평균
    vqs_val = None
    if vqs_key:
        v = row.get(vqs_key)
        if v is not None and not (isinstance(v, float) and pd.isna(v)):
            try:
                vqs_val = float(v)
            except:
                vqs_val = None
    if vqs_val is None:
        vqs_val = weighted_vqs(row)
    if vqs_val is None:
        return pd.Series({"status": "missing_scores", "vqs_final": None})

    # 2) SNR 페널티
    pen = snr_penalty_db(row.get("snr_db"))
    vf = clamp(float(vqs_val) + pen, 0.0, 100.0)
    return pd.Series({"status": "scored", "vqs_final": round(vf, 1)})


out = merged.apply(compute, axis=1)
merged["status"] = out["status"]
merged["vqs_final"] = out["vqs_final"]

# 저장
merged.to_csv(OUT_MERGED, index=False, encoding="utf-8-sig")

score_cols = ["file_id", "vqs_final"] + [
    c for c in merged.columns if c.startswith("s_")
]
scores_new = merged[score_cols]
scores_new.to_csv(OUT_SCORES, index=False, encoding="utf-8-sig")

print("Done:", OUT_MERGED.name, OUT_SCORES.name)
print("Columns(vqs source):", vqs_key if vqs_key else "weighted_vqs(backoff)")
