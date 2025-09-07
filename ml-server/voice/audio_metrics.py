# audio_metrics.py
import json, math, os
from pathlib import Path
from typing import List, Tuple, Dict, Optional

import numpy as np
import soundfile as sf
import librosa

# optional
try:
    import pyloudnorm as pyln
except Exception:
    pyln = None


# ---------------------------
# STT helpers
# ---------------------------
def load_stt(json_path: Path):
    data = json.loads(json_path.read_text(encoding="utf-8"))
    # words
    words = []
    if isinstance(data.get("words"), list):
        for w in data["words"]:
            s, e = float(w.get("start", 0)), float(w.get("end", 0))
            if e > s:
                words.append((s, e, (w.get("word") or w.get("text") or "").strip()))
    if not words and isinstance(data.get("segments"), list):
        for seg in data["segments"]:
            for w in seg.get("words", []):
                s, e = float(w.get("start", 0)), float(w.get("end", 0))
                if e > s:
                    words.append((s, e, (w.get("word") or w.get("text") or "").strip()))
    if not words and isinstance(data.get("segments"), list):
        for seg in data["segments"]:
            s, e = float(seg.get("start", 0)), float(seg.get("end", 0))
            if e > s:
                words.append((s, e, seg.get("text", "").strip()))
    words.sort(key=lambda x: (x[0], x[1]))

    # sentences (문장 경계: STT segments 사용)
    sentences = []
    if isinstance(data.get("segments"), list):
        for s in data["segments"]:
            if "start" in s and "end" in s and s["end"] > s["start"]:
                sentences.append(
                    (float(s["start"]), float(s["end"]), s.get("text", "").strip())
                )
    return words, sentences


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


# ---------------------------
# Audio helpers
# ---------------------------
def load_audio(wav_path: Path, target_sr=16000):
    y, sr = sf.read(str(wav_path), dtype="float32", always_2d=False)
    if y.ndim == 2:
        y = y.mean(axis=1)
    if sr != target_sr:
        y = librosa.resample(y, orig_sr=sr, target_sr=target_sr, res_type="kaiser_fast")
        sr = target_sr
    # normalize softly
    m = np.max(np.abs(y)) + 1e-12
    if m > 1.0:
        y = y / m
    return y.astype(np.float32), sr


def compute_clipping_pct(y: np.ndarray, thr_dbfs: float = -0.1):
    thr = 10.0 ** (thr_dbfs / 20.0)
    return 100.0 * float(np.mean(np.abs(y) >= thr))


def crest_db(y: np.ndarray):
    peak = np.max(np.abs(y)) + 1e-12
    rms = np.sqrt(np.mean(y**2)) + 1e-12
    return 20.0 * math.log10(peak / rms)


def compute_lufs_sd(y: np.ndarray, sr: int) -> Optional[float]:
    if pyln is None:
        return None
    try:
        meter = pyln.Meter(sr)
        st = meter.measure_loudness_blockwise(y.astype(np.float64), block_size=3.0)
        return float(np.std(st))
    except Exception:
        return None


def compute_snr_db_by_stt(
    y: np.ndarray, sr: int, speech_iv: List[Tuple[float, float]]
) -> Optional[float]:
    """
    STT의 말한 구간(speech_iv)과 나머지 구간을 RMS 프레임 기준으로 분리해 SNR(dB) 계산.
    RMS 프레임 타임스탬프(times)와 같은 길이의 boolean mask를 만들어 인덱싱 길이 불일치 방지.
    """
    if not speech_iv:
        return None

    # 32ms frame / 10ms hop (RMS와 동일 파라미터)
    frame = int(sr * 0.032)
    hop = int(sr * 0.01)

    # RMS 프레임과 그에 대응하는 시간축
    rms = librosa.feature.rms(y=y, frame_length=frame, hop_length=hop)[0]
    times = librosa.times_like(rms, sr=sr, hop_length=hop)  # len(times) == len(rms)

    # 말한 구간 마스크(프레임 단위)
    sp_mask = np.zeros_like(rms, dtype=bool)
    for s, e in speech_iv:
        # 오른쪽 열린 구간으로 겹침 처리(끝점 중복 완화)
        sp_mask |= (times >= s) & (times < e)

    # 각 구간의 평균 전력으로 SNR 계산
    sp = rms[sp_mask]
    nz = rms[~sp_mask]
    if sp.size == 0 or nz.size == 0:
        return None

    sp_p = float(np.mean(sp**2)) + 1e-12
    nz_p = float(np.mean(nz**2)) + 1e-12

    print("len(rms) =", len(rms))
    print("len(times) =", len(times))
    print("mask ok?  ", len(rms) == len(sp_mask))

    return 10.0 * math.log10(sp_p / nz_p)


def f0_track(y: np.ndarray, sr: int):
    f0 = librosa.yin(
        y,
        fmin=60,
        fmax=400,
        sr=sr,
        frame_length=int(sr * 0.032),
        hop_length=int(sr * 0.01),
    ).astype(np.float32)
    f0[~np.isfinite(f0)] = 0.0
    t = librosa.times_like(f0, sr=sr, hop_length=int(sr * 0.01)).astype(np.float32)
    return t, f0


def f0_range_semitones(f0: np.ndarray) -> Optional[float]:
    v = f0[f0 > 0]
    if len(v) < 10:
        return None
    p5, p95 = np.percentile(v, 5), np.percentile(v, 95)
    if p5 <= 0 or p95 <= 0:
        return None
    # semitones = 12 * log2(f2/f1)
    st = 12.0 * math.log2(p95 / p5)
    return float(st)


def upspeak_ratio(
    t: np.ndarray, f0: np.ndarray, sentence_ends: List[float]
) -> Optional[float]:
    if len(sentence_ends) == 0:
        return None
    ratios = []
    for end_t in sentence_ends:
        start_t = max(0.0, end_t - 0.30)
        m = (t >= start_t) & (t <= end_t)
        xt, yf = t[m], f0[m]
        vm = yf > 0
        if np.sum(vm) < 4:
            continue
        x = xt[vm] - xt[vm][0]
        y = yf[vm]
        A = np.vstack([x, np.ones_like(x)]).T
        slope, _ = np.linalg.lstsq(A, y, rcond=None)[0]
        ratios.append(1.0 if slope > 0 else 0.0)
    if not ratios:
        return None
    return float(np.mean(ratios))


def voice_breaks_per_min(
    t: np.ndarray, f0: np.ndarray, speech_iv: List[Tuple[float, float]]
):
    """보이스드 내부 60~300ms 무성 갭 개수/분"""
    if len(t) < 2:
        return 0.0
    vm = f0 > 0
    # 마스크를 speech 구간으로 제한
    sp_mask = np.zeros_like(vm, dtype=bool)
    for s, e in speech_iv:
        sp_mask |= (t >= s) & (t <= e)
    vm = vm & sp_mask
    # voiced 연속 구간 인덱스
    breaks = 0
    dt = float(np.mean(np.diff(t)))
    i = 0
    while i < len(vm) - 1:
        if vm[i] and not vm[i + 1]:
            # gap 시작
            j = i + 1
            while j < len(vm) and not vm[j]:
                j += 1
            gap = (j - (i + 1)) * dt
            if 0.06 <= gap <= 0.30:
                breaks += 1
            i = j
        else:
            i += 1
    total_min = (t[-1] - t[0]) / 60.0
    return (breaks / total_min) if total_min > 0 else 0.0


def phrase_stats(
    words: List[Tuple[float, float, str]], min_sil=0.4
) -> Tuple[Optional[float], Optional[float]]:
    """침묵≥0.4s 사이를 프레이즈 경계로 보고 길이 통계"""
    if not words:
        return None, None
    # 구간 경계 만들기
    bounds = [words[0][0]]
    for i in range(len(words) - 1):
        gap = max(0.0, words[i + 1][0] - words[i][1])
        if gap >= min_sil:
            bounds.append(words[i][1])  # 프레이즈 끝
            bounds.append(words[i + 1][0])  # 프레이즈 시작
    bounds.append(words[-1][1])
    # 짝으로 묶기
    segs = []
    for i in range(0, len(bounds) - 1, 2):
        segs.append((bounds[i], bounds[i + 1]))
    durs = [max(0.0, e - s) for s, e in segs if e > s]
    if not durs:
        return None, None
    mean = float(np.mean(durs))
    sd = float(np.std(durs, ddof=1)) if len(durs) > 1 else 0.0
    return mean, sd


# ---------------------------
# Main batch
# ---------------------------
def main():
    base = Path(__file__).parent
    json_dir = base / "json"
    wav_dir = base / "wav"
    out_csv = base / "audio_metrics.csv"

    rows = []
    for jp in sorted(json_dir.glob("*.json")):
        file_id = jp.stem
        wp = wav_dir / f"{file_id}.wav"
        if not wp.exists():
            print(f"[WARN] no wav for {file_id}")
            continue

        words, sentences = load_stt(jp)
        y, sr = load_audio(wp)
        dur = len(y) / sr

        # speech intervals from words
        speech_iv = merge_intervals([(s, e) for s, e, _ in words])

        # quality
        snr = compute_snr_db_by_stt(y, sr, speech_iv)
        clip = compute_clipping_pct(y)
        lufs_sd = compute_lufs_sd(y, sr)
        reverb_level = "unknown"  # (간단화; 추후 IR 추정 가능)
        crest = crest_db(y)

        # prosody tracks
        t, f0 = f0_track(y, sr)
        f0_range_st = f0_range_semitones(f0)
        sent_ends = [e for _, e, _ in sentences]
        up_ratio = upspeak_ratio(t, f0, sent_ends)
        vbreaks = voice_breaks_per_min(t, f0, speech_iv)
        avg_phrase, phrase_sd = phrase_stats(words, min_sil=0.4)

        rows.append(
            {
                "file_id": file_id,
                "duration_sec": round(dur, 3),
                "snr_db": None if snr is None else round(snr, 2),
                "clipping_pct": round(clip, 3),
                "lufs_short_term_sd": None if lufs_sd is None else round(lufs_sd, 2),
                "reverb_level": reverb_level,
                "crest_db": round(crest, 2),
                "f0_range_st": None if f0_range_st is None else round(f0_range_st, 2),
                "upspeak_ratio": None if up_ratio is None else round(up_ratio, 3),
                "voice_breaks_per_min": round(vbreaks, 2),
                "avg_phrase_sec": None if avg_phrase is None else round(avg_phrase, 2),
                "phrase_len_sd": None if phrase_sd is None else round(phrase_sd, 2),
            }
        )

    # write CSV
    import csv

    cols = [
        "file_id",
        "duration_sec",
        "snr_db",
        "clipping_pct",
        "lufs_short_term_sd",
        "reverb_level",
        "crest_db",
        "f0_range_st",
        "upspeak_ratio",
        "voice_breaks_per_min",
        "avg_phrase_sec",
        "phrase_len_sd",
    ]
    with out_csv.open("w", newline="", encoding="utf-8") as w:
        wr = csv.DictWriter(w, fieldnames=cols)
        wr.writeheader()
        wr.writerows(rows)

    print(f"Saved: {out_csv} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
