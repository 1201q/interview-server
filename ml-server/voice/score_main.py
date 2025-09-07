import anal_main

from typing import Dict, Optional
import numpy as np


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _lerp(x: float, x0: float, x1: float, y0: float, y1: float) -> float:
    if x0 == x1:
        return (y0 + y1) * 0.5
    t = (x - x0) / (x1 - x0)
    return y0 + (y1 - y0) * t


# 1) Pace Control
def score_pace_control(wpm: Optional[float], avg_phrase_sec: Optional[float]) -> float:
    if wpm is not None and wpm > 0:
        if wpm < 60 or wpm > 240:
            return 0.5
        if wpm <= 140:
            return _lerp(wpm, 60, 140, 0.5, 5.0)
        return _lerp(wpm, 140, 240, 5.0, 0.5)
    if avg_phrase_sec is None:
        return 2.5
    x = avg_phrase_sec
    if x <= 1.0 or x >= 12.0:
        return 1.0
    if 4.0 <= x <= 6.0:
        return 5.0 - abs(x - 5.0) * 0.5  # 5s 중심 완만한 peak
    if x < 4.0:
        return _lerp(x, 1.0, 4.0, 1.0, 4.5)
    return _lerp(x, 6.0, 12.0, 4.5, 1.0)


# 2) Pause Hygiene
def score_pause_hygiene(
    long_pause_ratio: Optional[float], breaks_per_min: Optional[float]
) -> float:
    base = 3.0
    if long_pause_ratio is not None:
        if long_pause_ratio <= 0.20:
            base += 1.5
        elif long_pause_ratio <= 0.35:
            base += 0.5
        elif long_pause_ratio <= 0.50:
            base -= 0.5
        else:
            base -= 1.5
    if breaks_per_min is not None:
        if breaks_per_min <= 1:
            base -= 1.0
        elif breaks_per_min <= 3:
            base += 0.5
        elif breaks_per_min <= 8:
            base += 1.0
        elif breaks_per_min <= 12:
            base -= 0.5
        else:
            base -= 1.0
    return float(_clamp(base, 0.0, 5.0))


# 3) Fluency
def score_fluency(
    phrase_len_sd: Optional[float], breaks_per_min: Optional[float]
) -> float:
    base = 3.0
    if phrase_len_sd is not None:
        if phrase_len_sd <= 2.0:
            base += 1.5
        elif phrase_len_sd <= 4.0:
            base += 0.5
        elif phrase_len_sd <= 6.0:
            base -= 0.5
        else:
            base -= 1.5
    if breaks_per_min is not None:
        if breaks_per_min < 2:
            base -= 0.5
        elif breaks_per_min > 12:
            base -= 1.0
    return float(_clamp(base, 0.0, 5.0))


# 4) Cadence (Upspeak)
def score_cadence(upspeak_ratio: Optional[float]) -> float:
    if upspeak_ratio is None:
        return 2.5
    r = upspeak_ratio
    if r <= 0.05:
        return 4.5
    if r <= 0.15:
        return 4.75
    if r <= 0.35:
        return 5.0
    if r <= 0.40:
        return 4.5
    if r <= 0.60:
        return 3.5
    if r <= 0.80:
        return 2.0
    return 0.5


# 5) Intonation Range (semitones)
def score_intonation_range(f0_range_st: Optional[float]) -> float:
    if f0_range_st is None:
        return 2.5
    x = f0_range_st
    if x <= 2.0:
        return 1.0  # 거의 단톤
    if x >= 20.0:
        return 1.5  # 과도한 변동
    if x <= 8.5:
        return _lerp(x, 2.0, 8.5, 1.0, 5.0)
    return _lerp(x, 8.5, 20.0, 5.0, 1.5)


def score_core(features: Dict[str, Optional[float]]) -> Dict[str, float]:
    s_pace = anal_main.analyze_pace(features.get("wpm"), features.get("avg_phrase_sec"))
    s_pause = anal_main.analyze_pause(
        features.get("long_pause_ratio"), features.get("voice_breaks_per_min")
    )
    s_flu = anal_main.analyze_fluency(
        features.get("phrase_len_sd"), features.get("voice_breaks_per_min")
    )
    s_cad = anal_main.analyze_cadence(features.get("upspeak_ratio"))
    s_int = anal_main.analyze_intonation(features.get("f0_range_st"))
    core = float(np.nanmean([s_pace, s_pause, s_flu, s_cad, s_int]))
    return {
        "s_pace_control": round(s_pace, 2),
        "s_pause_hygiene": round(s_pause, 2),
        "s_fluency": round(s_flu, 2),
        "s_cadence": round(s_cad, 2),
        "s_intonation_range": round(s_int, 2),
        "core_score": round(core, 2),
    }


def analyze_and_score(file_id: str):
    m = {}
    m |= {"file_id": file_id} | anal_main.analyze_pace(file_id)
    m |= anal_main.analyze_pause(file_id)
    m |= anal_main.analyze_fluency(file_id)
    m |= anal_main.analyze_cadence(file_id)
    m |= anal_main.analyze_intonation(file_id)
    scores = score_core(m)

    print(m)
    return {"metrics": m, "scores": scores}
