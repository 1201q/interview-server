# score_batch.py
import csv, math
from pathlib import Path

BASE = Path(__file__).parent
STT_CSV = BASE / "stt_metrics.csv"
AUD_CSV = BASE / "audio_metrics.csv"
OUT_SCORES = BASE / "scores.csv"
OUT_COACH = BASE / "coaching.csv"


# ---- 점수 보조 ----
def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def lerp(x, x0, x1, y0, y1):
    # x0..x1 범위에서 선형 보간 (바깥은 클램프)
    if x0 == x1:
        return y0
    t = (x - x0) / (x1 - x0)
    return y0 + clamp(t, 0.0, 1.0) * (y1 - y0)


def inv_lerp(x, a, b):  # 값이 작을수록 좋을 때
    return lerp(x, a, b, 5.0, 0.0)


def direct_lerp(x, a, b):  # 값이 클수록 좋을 때
    return lerp(x, a, b, 0.0, 5.0)


def wavg(pairs):
    num, den = 0.0, 0.0
    for v, w in pairs:
        if v is None or w <= 0:
            continue
        num += v * w
        den += w
    return (num / den) if den > 0 else None


# ---- 가중치(합=1). filler는 이번 스코프 제외 → 재분배 ----
WEIGHTS = {
    "audio_hygiene": 0.15,
    "volume_stability": 0.12,
    "pace_control": 0.12,
    "pause_hygiene": 0.10,
    "intonation_range": 0.10,
    "articulation_clarity": 0.10,
    "fluency": 0.08,
    "breath_control": 0.08,
    "confidence_tone": 0.10,
    "filler_control": 0.07,  # None이면 자동 재분배
}


# ---- 스코어 함수들 ----
def score_audio_hygiene(snr_db, clipping_pct, reverb_level):
    # SNR: 10→0 / 15→3 / 20→5
    s_snr = (
        None
        if snr_db is None
        else (
            0.0
            if snr_db <= 10
            else (
                3.0
                if snr_db <= 15
                else 5.0 if snr_db >= 20 else lerp(snr_db, 15, 20, 3.0, 5.0)
            )
        )
    )
    # 클리핑: 1%→0 / 0.3%→3 / 0.1%→5 (낮을수록 좋음)
    s_clip = (
        None
        if clipping_pct is None
        else (
            5.0
            if clipping_pct <= 0.1
            else (
                3.0
                if clipping_pct <= 0.3
                else 0.0 if clipping_pct >= 1.0 else inv_lerp(clipping_pct, 0.3, 1.0)
            )
        )
    )
    # 리버브 패널티(placeholder)
    pen = -0.5 if reverb_level == "high" else 0.0
    comp = wavg([(s_snr, 0.7), (s_clip, 0.3)])
    return None if comp is None else clamp(comp + pen, 0.0, 5.0)


def score_volume_stability(lufs_sd):
    # 2.5→0 / 1.8→3 / 1.0→5 (낮을수록 좋음)
    if lufs_sd is None:
        return None
    if lufs_sd <= 1.0:
        return 5.0
    if lufs_sd <= 1.8:
        return lerp(lufs_sd, 1.8, 1.0, 3.0, 5.0)
    if lufs_sd >= 2.5:
        return 0.0
    return lerp(lufs_sd, 2.5, 1.8, 0.0, 3.0)


def score_pace_control(wpm_mean, wpm_sd):
    # WPM: 90→0 / 120→3 / 160~170→5 / 210→0
    if wpm_mean is None:
        return None
    if wpm_mean <= 90:
        s_wpm = 0.0
    elif wpm_mean <= 120:
        s_wpm = lerp(wpm_mean, 90, 120, 0.0, 3.0)
    elif wpm_mean <= 160:
        s_wpm = lerp(wpm_mean, 120, 160, 3.0, 5.0)
    elif wpm_mean <= 170:
        s_wpm = 5.0
    elif wpm_mean <= 210:
        s_wpm = lerp(wpm_mean, 170, 210, 5.0, 0.0)
    else:
        s_wpm = 0.0
    # 변동 SD: 작을수록↑ (예시 앵커: 40→0 / 25→3 / 15→5)
    if wpm_sd is None:
        return s_wpm
    s_var = inv_lerp(wpm_sd, 25.0, 40.0)  # rough
    return clamp(0.6 * s_wpm + 0.4 * s_var, 0.0, 5.0)


def score_pause_hygiene(speaking_ratio, max_pause):
    # 발화 비율: 50→0 / 70→3 / 85→5
    if speaking_ratio is None:
        return None
    if speaking_ratio <= 0.5:
        s_sp = 0.0
    elif speaking_ratio <= 0.7:
        s_sp = lerp(speaking_ratio, 0.5, 0.7, 0.0, 3.0)
    elif speaking_ratio <= 0.85:
        s_sp = lerp(speaking_ratio, 0.7, 0.85, 3.0, 5.0)
    else:
        s_sp = 5.0
    # 최장 침묵: 5s→0 / 3s→3 / 1.5s→5 (짧을수록↑)
    if max_pause is None:
        return s_sp
    s_pause = inv_lerp(max_pause, 1.5, 5.0)
    return clamp(0.6 * s_sp + 0.4 * s_pause, 0.0, 5.0)


def score_intonation_range(f0_range_st, upspeak_ratio):
    # 범위: 3st→0 / 6st→3 / 10–12st→5
    if f0_range_st is None:
        return None
    if f0_range_st <= 3:
        s_rng = 0.0
    elif f0_range_st <= 6:
        s_rng = lerp(f0_range_st, 3, 6, 0.0, 3.0)
    elif f0_range_st <= 12:
        s_rng = lerp(f0_range_st, 6, 12, 3.0, 5.0)
    else:
        s_rng = 5.0
    # 업스픽: 0.6→0 / 0.35→3 / 0.15→5 (낮을수록↑)
    if upspeak_ratio is None:
        return s_rng
    s_up = inv_lerp(upspeak_ratio, 0.15, 0.60)
    return clamp(0.7 * s_rng + 0.3 * s_up, 0.0, 5.0)


def score_articulation_clarity(mean_confidence, crest_db):
    # STT confidence가 없으면(Whisper-1) 오디오 프록시(crest)만 사용
    # crest는 너무 낮아도/너무 높아도 문제. 12~22dB 권장. 여기선 완만하게 처리.
    s_conf = (
        None
        if (mean_confidence is None or mean_confidence > 0.99)
        else direct_lerp(mean_confidence, 0.80, 0.95)
    )
    s_crest = (
        5.0
        if crest_db is None
        else (
            0.0
            if crest_db < 8
            else (
                3.0
                if crest_db < 12
                else 5.0 if crest_db <= 22 else 3.0 if crest_db <= 28 else 2.0
            )
        )
    )
    return wavg([(s_conf, 0.5), (s_crest, 0.5)]) or s_crest


def score_fluency(breaks_per_min):
    # 6→0 / 4→3 / 1→5 (적을수록↑)
    if breaks_per_min is None:
        return None
    if breaks_per_min <= 1:
        return 5.0
    if breaks_per_min <= 4:
        return lerp(breaks_per_min, 4, 1, 3.0, 5.0)
    if breaks_per_min >= 6:
        return 0.0
    return lerp(breaks_per_min, 4, 6, 3.0, 0.0)


def score_breath_control(avg_phrase, phrase_sd):
    # 평균 6±2s 최고점, 분산 작을수록↑
    if avg_phrase is None:
        return None
    # 평균 길이 점수: 4~8s를 3~5점, 2~10s를 0~3점으로
    if avg_phrase < 2:
        s_mean = 0.0
    elif avg_phrase < 4:
        s_mean = lerp(avg_phrase, 2, 4, 0.0, 3.0)
    elif avg_phrase <= 8:
        s_mean = lerp(avg_phrase, 4, 8, 3.0, 5.0)
    elif avg_phrase <= 10:
        s_mean = lerp(avg_phrase, 8, 10, 5.0, 3.0)
    else:
        s_mean = 0.0
    # 분산 점수: 4s→0 / 2.5s→3 / 1.5s→5
    if phrase_sd is None:
        return s_mean
    s_var = inv_lerp(phrase_sd, 1.5, 4.0)
    return clamp(0.6 * s_mean + 0.4 * s_var, 0.0, 5.0)


def score_confidence_tone(upspeak_ratio):
    # 업스픽 낮을수록↑ (0.6→0 / 0.35→3 / 0.15→5)
    if upspeak_ratio is None:
        return None
    return inv_lerp(upspeak_ratio, 0.15, 0.60)


# ---- 코칭 규칙 (Top3 추출용) ----
def coaching_rules(r):
    tips = []
    # 값 가져오기
    snr = r.get("snr_db")
    maxp = r.get("max_pause_sec")
    sp = r.get("speaking_ratio_stt")
    wpm = r.get("wpm_mean")
    up = r.get("upspeak_ratio")
    lsd = r.get("lufs_short_term_sd")
    # 규칙
    if snr is not None and snr < 10:
        tips.append((f"SNR {snr:.1f} dB — 유선 마이크·조용한 공간 권장.", 1))
    if maxp is not None and maxp > 3.0:
        tips.append(
            (f"최장 침묵 {maxp:.1f}s — 모르면 ‘접근 방법’을 소리 내어 설명.", 1)
        )
    if sp is not None and sp < 0.7:
        tips.append(
            (f"발화 비율 {sp*100:.0f}% — 예시/결론 연결 문구로 공백 줄이기.", 1)
        )
    if wpm is not None and wpm > 190:
        tips.append((f"WPM {wpm:.0f}(빠름) — 문장 끝 0.3초 멈춤으로 160±20 목표.", 1))
    if up is not None and up > 0.35:
        tips.append((f"업스픽 {up*100:.0f}% — 결론 문장은 하강 억양으로 마무리.", 1))
    if lsd is not None and lsd > 2.5:
        tips.append(
            (f"라우드니스 변동 SD {lsd:.1f} LU — 문장 끝 호흡 후 다음 문장.", 1)
        )
    # 상위 3개만
    return [t for t, _ in tips][:3]


def main():
    # CSV 로드
    stt = {
        row["file_id"]: row for row in csv.DictReader(STT_CSV.open(encoding="utf-8"))
    }
    aud = {
        row["file_id"]: row for row in csv.DictReader(AUD_CSV.open(encoding="utf-8"))
    }
    ids = sorted(set(stt) & set(aud))

    score_rows, coach_rows = [], []

    for fid in ids:
        s = stt[fid]
        a = aud[fid]

        # 형변환
        def f(d, k):
            v = d.get(k, "")
            if v is None or v == "":
                return None
            try:
                return float(v)
            except:
                return None

        speaking = f(s, "speaking_ratio_stt")
        max_pause = f(s, "max_pause_sec")
        wpm_mean = f(s, "wpm_mean")
        wpm_sd = f(s, "wpm_sd")

        snr = f(a, "snr_db")
        clip = f(a, "clipping_pct")
        lsd = f(a, "lufs_short_term_sd")
        crest = f(a, "crest_db")
        f0st = f(a, "f0_range_st")
        up = f(a, "upspeak_ratio")
        brk = f(a, "voice_breaks_per_min")
        avg_phrase = f(a, "avg_phrase_sec")
        phrase_sd = f(a, "phrase_len_sd")
        reverb_level = a.get("reverb_level") or "unknown"

        # 품질 게이트
        flags = []
        if snr is not None and snr < 8:
            flags.append("snr_low")
        if clip is not None and clip >= 2.0:
            flags.append("clipping_high")
        if f0st is None:
            flags.append("f0_unreliable")
        gated = ("snr_low" in flags) or ("clipping_high" in flags)

        # 축별 점수
        scores = {
            "audio_hygiene": (
                None if gated else score_audio_hygiene(snr, clip, reverb_level)
            ),
            "volume_stability": None if gated else score_volume_stability(lsd),
            "pace_control": None if gated else score_pace_control(wpm_mean, wpm_sd),
            "pause_hygiene": (
                None if gated else score_pause_hygiene(speaking, max_pause)
            ),
            "intonation_range": None if gated else score_intonation_range(f0st, up),
            "articulation_clarity": (
                None if gated else score_articulation_clarity(None, crest)
            ),
            "fluency": None if gated else score_fluency(brk),
            "breath_control": (
                None if gated else score_breath_control(avg_phrase, phrase_sd)
            ),
            "confidence_tone": None if gated else score_confidence_tone(up),
            "filler_control": None,  # 이번 스코프 제외
        }

        # 가중치 재분배
        weights = dict(WEIGHTS)
        if scores["filler_control"] is None:
            lost = weights.pop("filler_control")
            remain = sum(weights.values())
            for k in weights:
                weights[k] *= 1 + lost / remain

        # VQS 계산
        pair_list = [(scores[k], weights[k]) for k in weights]
        v = wavg(pair_list)
        vqs = None if v is None else round((v / 5.0) * 100.0, 1)

        # 코칭
        combined = {
            "snr_db": snr,
            "max_pause_sec": max_pause,
            "speaking_ratio_stt": speaking,
            "wpm_mean": wpm_mean,
            "upspeak_ratio": up,
            "lufs_short_term_sd": lsd,
        }
        tips = [""] * 3
        for i, t in enumerate(coaching_rules(combined)):
            tips[i] = t

        score_rows.append(
            {
                "file_id": fid,
                "vqs": vqs,
                "flags": ";".join(flags),
                **{
                    f"s_{k}": (None if scores[k] is None else round(scores[k], 2))
                    for k in scores
                },
            }
        )
        coach_rows.append(
            {"file_id": fid, "tip1": tips[0], "tip2": tips[1], "tip3": tips[2]}
        )

    # 저장
    cols = ["file_id", "vqs", "flags"] + [f"s_{k}" for k in WEIGHTS.keys()]
    with OUT_SCORES.open("w", newline="", encoding="utf-8") as w:
        wr = csv.DictWriter(w, fieldnames=cols)
        wr.writeheader()
        wr.writerows(score_rows)

    with OUT_COACH.open("w", newline="", encoding="utf-8") as w:
        wr = csv.DictWriter(w, fieldnames=["file_id", "tip1", "tip2", "tip3"])
        wr.writeheader()
        wr.writerows(coach_rows)

    print(f"Saved: {OUT_SCORES} ({len(score_rows)} rows)")
    print(f"Saved: {OUT_COACH} ({len(coach_rows)} rows)")


if __name__ == "__main__":
    main()
