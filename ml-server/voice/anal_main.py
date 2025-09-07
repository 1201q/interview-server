from __future__ import annotations
import json, wave, contextlib
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import soundfile as sf
import librosa
import numpy as np
import parselmouth

BASE = Path(__file__).parent
WAV_DIR = BASE / "wav"
JSON_DIR = BASE / "json"


def load_audio(wav_path: Path, target_sr: int = 16000):
    y, sr = sf.read(str(wav_path), dtype="float32", always_2d=False)
    if y.ndim == 2:
        y = y.mean(axis=1)
    if sr != target_sr:
        y = librosa.resample(y, orig_sr=sr, target_sr=target_sr, res_type="kaiser_fast")
        sr = target_sr
    return y.astype(np.float32), sr


def merge_intervals(iv: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    if not iv:
        return []
    iv = sorted(iv)
    out = [list(iv[0])]
    for s, e in iv[1:]:
        if s <= out[-1][1]:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return [(float(s), float(e)) for s, e in out]


def phrase_len_sd(words: List[Dict], gap_sec: float = 0.6) -> Optional[float]:
    ph = segment_phrases(words, gap_sec)
    durs = [e - s for s, e in ph if e > s]
    if not durs:
        return None
    return float(np.std(durs, ddof=1)) if len(durs) > 1 else 0.0


def voice_breaks_per_min(
    y: np.ndarray, sr: int, speech_iv: List[Tuple[float, float]]
) -> Optional[float]:
    if not speech_iv:
        return None
    # 32ms frame / 10ms hop
    frame = int(sr * 0.032)
    hop = int(sr * 0.01)
    rms = librosa.feature.rms(y=y, frame_length=frame, hop_length=hop, center=True)[0]
    t = librosa.times_like(rms, sr=sr, hop_length=hop)

    # speech 구간 마스크
    sp_mask = np.zeros_like(rms, dtype=bool)
    for s, e in speech_iv:
        sp_mask |= (t >= s) & (t < e)

    if not np.any(sp_mask):  # 방어
        return None

    # speech 프레임 내 상대 임계치 (25퍼센타일)
    sp_rms = rms[sp_mask]
    thr = float(np.percentile(sp_rms, 25))
    thr = max(thr, 1e-6)

    voiced = (rms >= thr) & sp_mask  # speech 내에서만 판정
    dt = float(np.mean(np.diff(t))) if len(t) > 1 else (hop / sr)

    # 60~300ms 무성 구간을 break로 카운트
    breaks = 0
    i = 0
    n = len(voiced)
    while i < n - 1:
        # voiced -> unvoiced 전이
        if voiced[i] and not voiced[i + 1]:
            j = i + 1
            while j < n and (not voiced[j]) and sp_mask[j]:
                j += 1
            gap = (j - (i + 1)) * dt
            if 0.06 <= gap <= 0.30:
                breaks += 1
            i = j
        else:
            i += 1

    total_speaking_sec = sum(max(0.0, e - s) for s, e in speech_iv)
    total_min = (
        total_speaking_sec / 60.0 if total_speaking_sec > 0 else (len(y) / sr / 60.0)
    )
    return float(breaks / total_min) if total_min > 0 else None


def load_words(json_path: Path) -> List[Dict]:
    data = json.loads(json_path.read_text(encoding="utf-8"))
    words: List[Dict] = []
    for w in data.get("words", []):
        s, e = float(w.get("start", 0)), float(w.get("end", 0))
        if e > s:
            words.append(
                {
                    "start": s,
                    "end": e,
                    "word": str(w.get("word") or w.get("text") or "").strip(),
                }
            )
    words.sort(key=lambda x: (x["start"], x["end"]))
    return words


def segment_phrases(
    words: List[Dict], gap_sec: float = 1.0
) -> List[Tuple[float, float]]:
    if not words:
        return []
    s, prev_end = words[0]["start"], words[0]["end"]
    phrases = []
    for w in words[1:]:
        if w["start"] - prev_end >= gap_sec:
            phrases.append((s, prev_end))
            s = w["start"]
        prev_end = w["end"]
    phrases.append((s, prev_end))
    return phrases


def hz_to_st(f: np.ndarray, ref_hz: float = 55.0) -> np.ndarray:
    f = np.maximum(f, 1e-6)
    return 12.0 * np.log2(f / ref_hz)


def pitch_track_psm(y: np.ndarray, sr: int):
    snd = parselmouth.Sound(y, sampling_frequency=sr)
    pitch = snd.to_pitch(time_step=0.01)  # 10ms
    f0 = pitch.selected_array["frequency"].astype(float)
    t = np.arange(f0.shape[0]) * 0.01
    f0[f0 <= 1.0] = np.nan
    return t, f0


def normalize_intervals(intervals):
    """intervals를 (start, end) 쌍의 리스트로 정규화 + 정렬 + 머지."""
    pairs = []
    for it in intervals:
        if isinstance(it, dict):
            s = float(it.get("start", 0.0))
            e = float(it.get("end", 0.0))
        elif isinstance(it, (list, tuple)):
            if len(it) < 2:
                continue
            s = float(it[0])
            e = float(it[1])  # 3개 이상이면 앞의 2개만 사용
        else:
            continue
        if e > s:
            pairs.append((s, e))

    if not pairs:
        return []

    pairs.sort(key=lambda x: x[0])

    merged = [list(pairs[0])]
    for s, e in pairs[1:]:
        if s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])

    return [(float(s), float(e)) for s, e in merged]


def mask_to_intervals(t, intervals):
    """정규화된 intervals에 대해 mask 생성."""
    pairs = normalize_intervals(intervals)
    if len(pairs) == 0:
        return np.zeros_like(t, dtype=bool)
    m = np.zeros_like(t, dtype=bool)
    for s, e in pairs:
        m |= (t >= s) & (t <= e)
    return m


def wav_duration_sec(path: Path) -> float:
    with contextlib.closing(wave.open(str(path), "rb")) as wf:
        frames = wf.getnframes()
        rate = wf.getframerate() or 16000
        return frames / float(rate) if rate > 0 else 0.0


# ----------------------------
# analyze
# ----------------------------
def analyze_pace(file_id: str, gap_sec: float = 1.0) -> Dict[str, Optional[float]]:
    wav = WAV_DIR / f"{file_id}.wav"
    js = JSON_DIR / f"{file_id}.json"
    dur = wav_duration_sec(wav)
    words = load_words(js)

    # WPM
    token_count = sum(1 for w in words if any(ch.isalnum() for ch in w["word"]))
    wpm = (token_count / (dur / 60.0)) if dur > 0 else None

    # 프레이즈 평균 길이
    phrases = segment_phrases(words, gap_sec)
    durs = [(e - s) for s, e in phrases if e > s]
    avg_phrase_sec = (sum(durs) / len(durs)) if durs else None

    return {
        "file_id": file_id,
        "duration_sec": round(dur, 3),
        "wpm": None if wpm is None else round(wpm, 1),
        "avg_phrase_sec": None if avg_phrase_sec is None else round(avg_phrase_sec, 2),
        "phrase_count": len(phrases),
    }


def analyze_pause(file_id: str, long_thr: float = 0.8) -> Dict[str, Optional[float]]:
    """
    출력:
    - long_pause_ratio: 단어 사이 공백 중 long_thr(기본 0.8s) 이상 비율
    - max_pause_sec: 가장 긴 공백 길이
    - speaking_ratio_stt: (마지막 단어 end - 첫 단어 start) 중 '말한 총 시간'의 비율
                            (단어 구간을 단순 합산: end-start)
    """
    js = JSON_DIR / f"{file_id}.json"
    ws = load_words(js)
    if not ws:
        return {
            "file_id": file_id,
            "long_pause_ratio": None,
            "max_pause_sec": None,
            "speaking_ratio_stt": None,
        }

    # 간격(침묵) 계산
    gaps = [ws[i]["start"] - ws[i - 1]["end"] for i in range(1, len(ws))]
    long_pause_ratio = (
        (sum(1 for g in gaps if g >= long_thr) / len(gaps)) if gaps else 0.0
    )
    max_pause_sec = max(gaps) if gaps else 0.0

    # 말한 시간 비율 (STT 구간 단순 합)
    speak_sum = sum(w["end"] - w["start"] for w in ws)
    total_span = max(1e-9, ws[-1]["end"] - ws[0]["start"])
    speaking_ratio_stt = speak_sum / total_span

    return {
        "file_id": file_id,
        "long_pause_ratio": round(long_pause_ratio, 3),
        "max_pause_sec": round(max_pause_sec, 3),
        "speaking_ratio_stt": round(speaking_ratio_stt, 3),
    }


def analyze_fluency(file_id: str, gap_sec: float = 1.0) -> Dict[str, Optional[float]]:
    wav = WAV_DIR / f"{file_id}.wav"
    js = JSON_DIR / f"{file_id}.json"
    y, sr = load_audio(wav)
    words = load_words(js)

    # speaking intervals from words
    speech_iv = merge_intervals([(w["start"], w["end"]) for w in words])
    vbreaks = voice_breaks_per_min(y, sr, speech_iv)
    sd = phrase_len_sd(words, gap_sec=gap_sec)

    return {
        "file_id": file_id,
        "voice_breaks_per_min": None if vbreaks is None else round(vbreaks, 2),
        "phrase_len_sd": None if sd is None else round(sd, 2),
        "phrase_count": len(segment_phrases(words, gap_sec=gap_sec)),
    }


def analyze_cadence(file_id: str, gap_sec: float = 0.6) -> Dict[str, Optional[float]]:
    """
    upspeak_ratio: 프레이즈 끝 0.5초 구간에서 피치가 +0.8st 이상 상승하는 프레이즈 비율
    eligible_phrases: 분석에 사용된 프레이즈 개수(>=0.6s)
    """
    wav = WAV_DIR / f"{file_id}.wav"
    js = JSON_DIR / f"{file_id}.json"
    y, sr = load_audio(wav)
    words = load_words(js)
    phrases = segment_phrases(words, gap_sec=gap_sec)

    t, f0 = pitch_track_psm(y, sr)
    if t is None or f0 is None:
        return {
            "file_id": file_id,
            "upspeak_ratio": None,
            "eligible_phrases": 0,
            "upspeak_phrases": 0,
        }

    st = hz_to_st(f0)

    ups, elig = 0, 0
    for s, e in phrases:
        dur = e - s
        if dur < 0.6:
            continue
        start_t = max(s, e - 0.5)
        m = (t >= start_t) & (t <= e)
        if not np.any(m):
            continue
        seg = st[m]
        seg = seg[~np.isnan(seg)]
        if seg.size < 5:
            continue
        q10 = float(np.nanpercentile(seg, 10))
        q90 = float(np.nanpercentile(seg, 90))
        if (q90 - q10) > 0.8:
            ups += 1
        elig += 1

    ratio = (ups / elig) if elig > 0 else None
    return {
        "file_id": file_id,
        "upspeak_ratio": None if ratio is None else round(ratio, 3),
        "eligible_phrases": elig,
        "upspeak_phrases": ups,
    }


def analyze_intonation(file_id: str) -> Dict[str, Optional[float]]:
    """
    f0_range_st: (p80 - p20) semitones, speech 구간 내의 voiced 프레임만 사용.
    parselmouth 미설치/voiced 부족 시 None.
    """
    wav = WAV_DIR / f"{file_id}.wav"
    js = JSON_DIR / f"{file_id}.json"

    y, sr = load_audio(wav)
    intervals = load_words(js)  # speech 구간

    t, f0 = pitch_track_psm(y, sr)
    if t is None or f0 is None:
        return {
            "file_id": file_id,
            "f0_range_st": None,
            "voiced_count": 0,
            "total_frames": 0,
        }

    mask = mask_to_intervals(t, intervals)
    voiced = f0[mask]
    voiced = voiced[~np.isnan(voiced)]

    if voiced.size < 20:
        return {
            "file_id": file_id,
            "f0_range_st": None,
            "voiced_count": int(voiced.size),
            "total_frames": int(mask.sum()),
        }

    st = hz_to_st(voiced)
    p20 = float(np.nanpercentile(st, 20))
    p80 = float(np.nanpercentile(st, 80))
    rng = p80 - p20

    return {
        "file_id": file_id,
        "f0_range_st": round(rng, 2),
        "voiced_count": int(voiced.size),
        "total_frames": int(mask.sum()),
    }


# score


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _lerp(x: float, x0: float, x1: float, y0: float, y1: float) -> float:
    if x0 == x1:
        return (y0 + y1) * 0.5
    t = (x - x0) / (x1 - x0)
    return y0 + (y1 - y0) * t


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


#
def collect_features(file_id: str):
    pace = analyze_pace(file_id)  # wpm, avg_phrase_sec
    pause = analyze_pause(
        file_id
    )  # long_pause_ratio, max_pause_sec, speaking_ratio_stt
    flu = analyze_fluency(file_id)  # voice_breaks_per_min, phrase_len_sd
    cad = analyze_cadence(file_id)  # upspeak_ratio
    into = analyze_intonation(file_id)  # f0_range_st

    feats = {
        "wpm": pace.get("wpm"),
        "avg_phrase_sec": pace.get("avg_phrase_sec"),
        "long_pause_ratio": pause.get("long_pause_ratio"),
        # 핵심: breaks_per_min은 여기서 가져온다
        "voice_breaks_per_min": flu.get("voice_breaks_per_min"),
        "phrase_len_sd": flu.get("phrase_len_sd"),
        "upspeak_ratio": cad.get("upspeak_ratio"),
        "f0_range_st": into.get("f0_range_st"),
    }
    return feats


def score_all(feats: dict):
    s_pace = score_pace_control(feats.get("wpm"), feats.get("avg_phrase_sec"))
    s_pause = score_pause_hygiene(
        feats.get("long_pause_ratio"), feats.get("voice_breaks_per_min")
    )
    s_flu = score_fluency(feats.get("phrase_len_sd"), feats.get("voice_breaks_per_min"))
    s_cad = score_cadence(feats.get("upspeak_ratio"))
    s_int = score_intonation_range(feats.get("f0_range_st"))
    core = round(sum([s_pace, s_pause, s_flu, s_cad, s_int]) / 5.0, 2)
    return {
        "s_pace_control": round(s_pace, 2),
        "s_pause_hygiene": round(s_pause, 2),
        "s_fluency": round(s_flu, 2),
        "s_cadence": round(s_cad, 2),
        "s_intonation_range": round(s_int, 2),
        "core_score": core,
    }


def print_report(file_id: str):
    feats = collect_features(file_id)
    scores = score_all(feats)
    print(f"[{file_id}] Core-5 Scores")
    for k in [
        "s_pace_control",
        "s_pause_hygiene",
        "s_fluency",
        "s_cadence",
        "s_intonation_range",
        "core_score",
    ]:
        print(f"  {k:20s}: {scores[k]}")
    print("\n[Inputs]")
    show = {
        "wpm": feats["wpm"],
        "avg_phrase_sec": feats["avg_phrase_sec"],
        "long_pause_ratio": feats["long_pause_ratio"],
        "voice_breaks_per_min": feats["voice_breaks_per_min"],
        "phrase_len_sd": feats["phrase_len_sd"],
        "upspeak_ratio": feats["upspeak_ratio"],
        "f0_range_st": feats["f0_range_st"],
    }
    for k, v in show.items():
        print(f"  {k:20s}: {None if v is None else round(v, 3)}")


print_report("input2")
