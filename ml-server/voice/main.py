from __future__ import annotations

from pathlib import Path
import os, soundfile as sf
import json
import io
import json
import math
import argparse
from typing import Dict, List, Tuple, Optional, Union

import numpy as np
import soundfile as sf
import librosa

# ------------------------------
import webrtcvad
import pyloudnorm as pyln
import parselmouth


# ------------------------------------------------------------------
# 유틸 함수
# ------------------------------------------------------------------


def to_mono_16k(y: np.ndarray, sr: int) -> Tuple[np.ndarray, int]:
    """
    오디오 데이터를 일관된 포맷(모노, 16kHz, float32, [-1,1] 범위)으로 변환
    (1) 스테레오 → 모노 평균화
    (2) 16kHz로 리샘플
    (3) 진폭 범위 정규화(필요 시)
    """
    if y.ndim == 2:  # 스테레오인 경우 평균
        y = np.mean(y, axis=1)
    target_sr = 16000
    if sr != target_sr:
        # kaiser_fast는 속도/품질 균형이 좋은 기본값
        y = librosa.resample(y, orig_sr=sr, target_sr=target_sr, res_type="kaiser_fast")
        sr = target_sr
    # 진폭이 1을 넘는 경우 [-1,1]로 스케일링
    max_abs = np.max(np.abs(y)) + 1e-12
    if max_abs > 1.0:
        y = y / max_abs
    return y.astype(np.float32), sr


def float_to_pcm16(y: np.ndarray) -> bytes:
    """
    webrtcvad가 PCM16을 요구하므로 float32 → int16로 변환
    """
    y16 = np.clip(y * 32767.0, -32768, 32767).astype(np.int16)
    return y16.tobytes()


def compute_clipping_pct(y: np.ndarray, threshold_dbfs: float = -0.1) -> float:
    """
    클리핑 비율(%)
    -0.1 dBFS에 근접/초과하는 샘플 비율을 계산합니다.

    클리핑?
    오디오 신호가 디지털 최대 진폭에 근접하거나 초과할 때 생기는 왜곡 현상.
    클리핑 비율이 높을수록 오디오가 왜곡될 가능성 큼.
    """
    thr = 10.0 ** (threshold_dbfs / 20.0)  # -0.1dBFS -> 약 0.9886
    over = np.sum(np.abs(y) >= thr)
    return 100.0 * over / (len(y) + 1e-12)


def crest_factor_db(y: np.ndarray) -> float:
    """
    크레스트 팩터(dB) = 20*log10(피크/RMS)
    - 다이내믹 헤드룸, 피크 대비 평균 에너지 차이를 나타냅니다.

    크레스트 팩터가 높을수록 신호에 순간적인 피크가 많고, 낮을수록 신호가 평탄하다는 의미
    오디오 품질, 다이내믹스, 왜곡 위험 등을 평가할 때 참고할 수 있는 지표
    """
    peak = np.max(np.abs(y)) + 1e-12
    rms = np.sqrt(np.mean(y**2)) + 1e-12
    return 20.0 * math.log10(peak / rms)


def compute_loudness(y: np.ndarray, sr: int) -> Dict[str, float]:
    """
    라우드니스 및 레벨 관련 지표 계산
    - lufs_integrated: 전체 통합 라우드니스
    - lufs_short_term_sd: 3초 창 단기 라우드니스 표준편차(볼륨 안정성 지표로 사용)
    - peak_dbfs, crest_db: 기본 레벨/다이내믹 지표
    """
    res = {
        "lufs_integrated": None,
        "lufs_short_term_sd": None,
        "peak_dbfs": 20.0 * math.log10(np.max(np.abs(y)) + 1e-12),
        "crest_db": crest_factor_db(y),
    }
    meter = pyln.Meter(sr)  # EBU R128
    try:
        integ = meter.integrated_loudness(y.astype(np.float64))
        st = meter.measure_loudness_blockwise(y.astype(np.float64), block_size=3.0)
        res["lufs_integrated"] = float(integ)
        res["lufs_short_term_sd"] = float(np.std(st))
    except Exception:
        pass
    return res


def merge_adjacent(
    segments: List[Tuple[float, float, str]], tol: float = 0.04
) -> List[Tuple[float, float, str]]:
    """
    입력: 구간 리스트
    인접, 짧게 끊어진 구간을 하나로 병합(스무딩).

    분석 결과가 부드럽고 해석하기 쉽게 만듦.
    """
    if not segments:
        return []
    out = [list(segments[0])]
    for s, e, t in segments[1:]:
        ps, pe, pt = out[-1]
        if t == pt or abs(s - pe) <= tol:
            out[-1][1] = e
        else:
            out.append([s, e, t])
    return [(float(s), float(e), str(t)) for s, e, t in out]


def run_vad_segments(
    y: np.ndarray, sr: int, mode: int = 2, frame_ms: int = 20
) -> List[Tuple[float, float, str]]:
    """
    VAD(음성/무성)로 구간 나누기

    merge_adjacent 호출해서 분석 결과가 더 부드럽게 해석하게 만듦.
    분석에 필요한 필수적인 구간 정보 제공

    반환 형식: [(startSec, endSec, "speech"|"silence"), ...]

    """
    if webrtcvad is None:
        # Fallback: energy threshold VAD (rough)

        y_vad = librosa.effects.preemphasis(y, coef=0.97)
        rms = librosa.feature.rms(
            y=y_vad, frame_length=int(sr * 0.032), hop_length=int(sr * 0.02)
        )[0]
        times = librosa.times_like(rms, sr=sr, hop_length=int(sr * 0.02))
        p60 = np.percentile(rms, 60)
        thr = max(5e-4, p60)
        mask = rms > thr
        segments = []
        state, start_t = None, 0.0
        for t, m in zip(times, mask):
            label = "speech" if m else "silence"
            if state is None:
                state, start_t = label, t
            elif label != state:
                segments.append((start_t, t, state))
                state, start_t = label, t
        segments.append((start_t, float(len(y) / sr), state))
        segments = merge_adjacent(segments)
    else:
        # webrtcvad 사용 경로
        vad = webrtcvad.Vad(mode)  # 0~3 (3이 가장 공격적)
        frame_len = int(sr * frame_ms / 1000)
        hop_len = frame_len
        bytes_frames = [
            float_to_pcm16(y[i : i + frame_len])
            for i in range(0, len(y) - frame_len + 1, hop_len)
        ]
        times = np.arange(len(bytes_frames)) * (hop_len / sr)
        speech_flags = [vad.is_speech(b, sr) for b in bytes_frames]

        # speech/silence 세그먼트화
        segments: List[Tuple[float, float, str]] = []
        state = None
        start_t = 0.0
        for t, is_sp in zip(times, speech_flags):
            label = "speech" if is_sp else "silence"
            if state is None:
                state = label
                start_t = float(t)
            elif label != state:
                segments.append((start_t, float(t), state))
                state = label
                start_t = float(t)
        end_t = float(len(y) / sr)
        if state is not None:
            segments.append((start_t, end_t, state))
        return merge_adjacent(segments)

    if not any(t == "speech" for _, _, t in segments) and (np.max(np.abs(y)) > 1e-3):
        intervals = librosa.effects.split(
            y, top_db=30, frame_length=int(sr * 0.032), hop_length=int(sr * 0.02)
        )
        if len(intervals):
            segs, last = [], 0.0
            for a, b in intervals:
                if a / sr > last:
                    segs.append((last, a / sr, "silence"))
                segs.append((a / sr, b / sr, "speech"))
                last = b / sr
            if last < len(y) / sr:
                segs.append((last, len(y) / sr, "silence"))
            segments = merge_adjacent(segs)
    return segments


def compute_snr_db(
    y: np.ndarray, sr: int, segments: List[Tuple[float, float, str]]
) -> Optional[float]:
    """
    SNR(dB) 근사: 음성 구간 평균전력 / 무성 구간 평균전력
    - 무성 구간이 충분치 않으면 None

    잡음이 얼마나 많은지, 신호가 얼마나 뚜렷한지 정량적으로 판단하는데 사용.
    """
    speech_pow, noise_pow = [], []
    for s, e, t in segments:
        seg = y[int(s * sr) : int(e * sr)]
        p = np.mean(seg**2) + 1e-12
        if t == "speech":
            speech_pow.append(p)
        else:
            noise_pow.append(p)
    if len(speech_pow) == 0 or len(noise_pow) == 0:
        return None
    return 10.0 * math.log10(np.mean(speech_pow) / (np.mean(noise_pow) + 1e-12))


def compute_timing_metrics(
    segments: List[Tuple[float, float, str]], total_dur: float
) -> Dict[str, float]:
    """
    타이밍/페이싱 기본 지표
    - speech_ratio, silence_ratio, max_pause_sec, start_latency_sec

    speech_ratio : 전체 길이 대비 음성 비율
    silence_ratio : 무성 비율
    max_pause_sec : 가장 긴 침묵 기간
    start_latency_sec : 오디오 시작 시 첫 침묵 구간 길이

    음성/무성 구간 정보와 전체 오디오 길이를 받아
    타이밍 및 페이싱 관련 핵심 지표를 계산합니다.
    """
    speech = sum(max(0.0, e - s) for s, e, t in segments if t == "speech")
    silence = sum(max(0.0, e - s) for s, e, t in segments if t == "silence")
    max_pause = max([0.0] + [e - s for s, e, t in segments if t == "silence"])
    start_latency = 0.0
    if segments and segments[0][2] == "silence":
        start_latency = segments[0][1] - segments[0][0]
    return dict(
        duration_sec=float(total_dur),
        speech_ratio=float(speech / (total_dur + 1e-12)),
        silence_ratio=float(silence / (total_dur + 1e-12)),
        max_pause_sec=float(max_pause),
        start_latency_sec=float(start_latency),
    )


def compute_energy_tracks(y: np.ndarray, sr: int) -> Dict[str, np.ndarray]:
    """
    에너지/스펙트럼 트랙(클라에서 시각화용)
    - rms: 프레임별 에너지
    - centroid: 스펙트럼 무게중심(고주파 비중 지표, 소리의 밝기)
    - flatness: 스펙트럼 평탄도(잡음/휘파람, 비정상적 신호 탐지)
    - rolloff: 에너지 상위대역 경계(고주파 에너지 분포)
    - times: 각 프레임의 시간 정보
    """
    rms = librosa.feature.rms(
        y=y, frame_length=int(sr * 0.032), hop_length=int(sr * 0.01)
    )[0]
    times = librosa.times_like(rms, sr=sr, hop_length=int(sr * 0.01))
    cent = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=int(sr * 0.01))[0]
    flat = librosa.feature.spectral_flatness(y=y, hop_length=int(sr * 0.01))[0]
    roll = librosa.feature.spectral_rolloff(y=y, sr=sr, hop_length=int(sr * 0.01))[0]
    return {
        "times": times.astype(np.float32),
        "rms": rms.astype(np.float32),
        "centroid": cent.astype(np.float32),
        "flatness": flat.astype(np.float32),
        "rolloff": roll.astype(np.float32),
    }


def compute_pitch(y: np.ndarray, sr: int) -> Dict[str, np.ndarray]:
    """
    오디오 신호에서 프레임별 피치(F0) 계산
    - 10ms 간격으로 신뢰도 높게 계산
    - 억양, 음성의 높낮이 변화, 유창성, 말끝올림(업스픽) 등 음성 특성 분석에 활용됩니다.
    """
    if parselmouth is not None:
        try:
            snd = parselmouth.Sound(y, sampling_frequency=sr)
            pitch = snd.to_pitch(time_step=0.01, pitch_floor=60, pitch_ceiling=400)
            f0 = pitch.selected_array["frequency"].astype(np.float32)  # 무성=0
            times = np.arange(len(f0)) * 0.01
            return {"times": times, "f0": f0}
        except Exception:
            pass


def voiced_mask(f0: np.ndarray) -> np.ndarray:
    """
    무성이 아닌 프레임을 찾아 불리언 마스크 배열로 반환.
    음성 구간만 선택하거나 통계 계산시 보이스드 프레임만 사욜할 때 활용
    """
    return (f0 > 0).astype(np.bool_)


def f0_summary(f0: np.ndarray) -> Dict[str, Optional[float]]:
    """
    F0 요약 지표: 보이스드만 사용
    - 중앙값, 범위(95-5 백분위 차)
    => 중앙값과 범위는 면접자의 음성 억양, 말의 다양성, 특이점 등을 평가하는 데 중요한 지표
    """
    vm = voiced_mask(f0)
    if not np.any(vm):
        return {"f0_median_hz": None, "f0_range_hz": None}
    vals = f0[vm]
    return {
        "f0_median_hz": float(np.median(vals)),
        "f0_range_hz": float(np.percentile(vals, 95) - np.percentile(vals, 5)),
    }


def compute_upspeak_ratio(
    times_f0: np.ndarray, f0: np.ndarray, segments: List[Tuple[float, float, str]]
) -> Optional[float]:
    """
    면접자의 말끝 올림 업스픽(말끝 올림) 비율 추정

    - 프레이즈 말미 300ms 구간의 F0 선형 기울기가 양수인 비율
    - 프레이즈 경계는 '침묵>=0.4s' 구간의 시작점을 사용

    값이 높을수록 말끝이 올라가는 경향이 많다는 의미입니다.
    """
    phrase_ends = [s for s, e, t in segments if t == "silence" and (e - s) >= 0.4]
    if len(phrase_ends) == 0:
        return None
    ratio_pos = []
    for st in phrase_ends:
        end_t = st
        start_t = max(0.0, end_t - 0.3)
        m = (times_f0 >= start_t) & (times_f0 <= end_t)
        if np.sum(m) < 4:
            continue
        xf = times_f0[m]
        yf = f0[m]
        vm = voiced_mask(yf)
        if np.sum(vm) < 3:
            continue
        # 선형 회귀로 기울기 추정
        x = xf[vm] - xf[vm][0]
        y = yf[vm]
        A = np.vstack([x, np.ones_like(x)]).T
        slope, _ = np.linalg.lstsq(A, y, rcond=None)[0]
        ratio_pos.append(1.0 if slope > 0 else 0.0)
    if len(ratio_pos) == 0:
        return None
    return float(np.mean(ratio_pos))


def voice_breaks_per_min(
    times_f0: np.ndarray, f0: np.ndarray, segments: List[Tuple[float, float, str]]
) -> float:
    """
    보이스드 내부의 짧은 무성 갭(<300ms)을 분당 발생 횟수로 근사
    - 유창성 저하(끊김) 지표로 사용
    값이 높을수록 말이 자주 끊기는 경향이 있다는 의미입니다.
    """
    vm = voiced_mask(f0)
    dt = np.mean(np.diff(times_f0)) if len(times_f0) > 1 else 0.01
    gaps, in_gap, gap_len = [], False, 0.0
    for v in vm:
        if not v and not in_gap:
            in_gap = True
            gap_len = dt
        elif not v and in_gap:
            gap_len += dt
        elif v and in_gap:
            gaps.append(gap_len)
            in_gap = False
    if in_gap:
        gaps.append(gap_len)
    short_gaps = [g for g in gaps if g < 0.3 and g >= 0.06]  # 60~300ms
    total_speech = sum(max(0.0, e - s) for s, e, t in segments if t == "speech")
    minutes = max(1e-6, total_speech / 60.0)
    return float(len(short_gaps) / minutes)


def volume_stability_from_lufs_sd(lufs_st_sd: Optional[float]) -> Optional[float]:
    """
    단기 LUFS 표준편차 → [0,1] 안정성 스코어로 정규화(낮을수록 안정적)

    오디오의 볼륨이 얼마나 일정하게 유지되는지를 정량적으로 평가하는 데 사용되며,
    면접 음성의 볼륨 안정성 지표로 활용됩니다.
    """
    if lufs_st_sd is None:
        return None
    val = 1.0 - np.interp(lufs_st_sd, [1.0, 2.5], [0.0, 1.0])
    return float(np.clip(val, 0.0, 1.0))


def linear_score(
    x: Optional[float], a: float, b: float, invert: bool = False
) -> Optional[float]:
    """
    선형 맵핑 유틸
    - x를 [a,b] → [0,5]로 선형 변환, 범위 밖은 0/5로 클램프
    - invert=True면 방향 반전([b,a]로 맵핑)
    """
    if x is None:
        return None
    x = float(x)
    if invert:
        a, b = b, a
    if x <= a:
        return 0.0
    if x >= b:
        return 5.0
    return (x - a) / (b - a) * 5.0


def compute_breath_and_phrases(
    y: np.ndarray,
    sr: int,
    segments: List[Tuple[float, float, str]],
    tracks: Dict[str, np.ndarray],
) -> Dict[str, float]:
    """
    호흡/프레이즈 길이 추정(경량 휴리스틱)
    - 호흡 후보: flatness↑ & centroid↑ & rms↓ 조건의 스파이크
    - 프레이즈 경계: 침묵>=0.4s의 시작 또는 호흡 이벤트

    - breath_events_per_min : 분당 호흡 이벤트 수
    면접자의 발화 호흡 패턴, 문장 길이, 리듬, 자연스러움 등을 평가하는 데 활용됩니다.
    """
    times = tracks["times"]
    flat = tracks["flatness"]
    rms = tracks["rms"]
    cent = tracks["centroid"]

    # 호흡 후보 검출
    breath_idx = (
        (flat > np.percentile(flat, 85))
        & (cent > np.percentile(cent, 70))
        & (rms < np.percentile(rms, 50))
    )
    breath_times = times[breath_idx]
    # 너무 가까운 호흡 후보는 병합(0.3s 이내)
    if len(breath_times) > 0:
        merged = [breath_times[0]]
        for t in breath_times[1:]:
            if (t - merged[-1]) > 0.3:
                merged.append(t)
        breath_times = np.array(merged)

    # 분당 호흡 이벤트 수(음성 구간 기준)
    total_speech = sum(max(0.0, e - s) for s, e, t in segments if t == "speech")
    minutes = max(1e-6, total_speech / 60.0)
    breaths_per_min = float(len(breath_times) / minutes)

    # 프레이즈 경계 수집
    boundaries = [s for s, e, t in segments if t == "silence" and (e - s) >= 0.4]
    boundaries += list(breath_times)
    boundaries = np.array(
        sorted([b for b in boundaries if 0.0 < b < float(len(y) / sr)])
    )

    # 프레이즈 길이 통계(0.8~12s 구간만 사용)
    if len(boundaries) < 2:
        avg_phrase = float(total_speech) if total_speech > 0 else 0.0
        sd_phrase = 0.0
    else:
        diffs = np.diff(boundaries)
        diffs = diffs[(diffs > 0.8) & (diffs < 12.0)]
        if len(diffs) == 0:
            avg_phrase, sd_phrase = float(np.clip(total_speech, 0.0, 12.0)), 0.0
        else:
            avg_phrase, sd_phrase = float(np.mean(diffs)), float(np.std(diffs))

    return {
        "avg_phrase_sec": avg_phrase,
        "phrase_len_sd": sd_phrase,
        "breath_events_per_min": breaths_per_min,
    }


def compute_articulation_indices(
    y: np.ndarray, sr: int, tracks: Dict[str, np.ndarray]
) -> Dict[str, float]:
    """
    발음 품질 프록시 지표(경량):
    - sibilance_idx: 5–9kHz 대역 에너지 비율 평균(치찰음 과다 경향, 시끄러운 'ㅅ', 'ㅈ' 등)
    - plosive_idx: 60–300Hz 대역 비율 평균(파열음/팝 과다 경향, 팝 노이즈, 'ㅍ', 'ㅂ' 등)

    면접자의 발음 명료도, 잡음, 과도한 치찰음/파열음 등 음성 품질을 정량적으로 평가
    0~1 값. 높을수록 해당 특성 두드러짐
    """
    S = np.abs(librosa.stft(y, n_fft=1024, hop_length=int(sr * 0.01)))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=1024)
    hi_band = (freqs >= 5000) & (freqs <= 9000)
    lo_band = (freqs >= 60) & (freqs <= 300)
    total = np.sum(S, axis=0) + 1e-12
    sibilance_idx = float(
        np.clip(np.mean(np.sum(S[hi_band], axis=0) / total), 0.0, 1.0)
    )
    plosive_idx = float(np.clip(np.mean(np.sum(S[lo_band], axis=0) / total), 0.0, 1.0))
    return {"sibilance_idx": sibilance_idx, "plosive_idx": plosive_idx}


# ------------------------------------------------------------------
# 점수화(10축 + VQS)
# ------------------------------------------------------------------


def blend(
    values: List[Optional[float]], weights: Optional[List[float]] = None
) -> Optional[float]:
    """
    여러 요소의 가중 평균(결측은 제외) → [0,5] 내로 클램프

    여러 음성 평가 지표를 하나의 점수로 합산할 때, 결측값을 자동으로 제외,
    각 지표의 중요도를 반영할 수 있도록 설계
    복수의 특성 점수를 가중 평균으로 통합하는 데 사용
    """
    xs = [v for v in values if v is not None]
    if not xs:
        return None
    if weights is None:
        weights = [1.0] * len(values)
    ws = [w for v, w in zip(values, weights) if v is not None]
    s = np.dot(xs, np.array(ws)) / (np.sum(ws) + 1e-12)
    return float(np.clip(s, 0.0, 5.0))


def weighted_score(
    scores: Dict[str, Optional[float]],
    weights: Dict[str, float],
    conf: Dict[str, float],
) -> float:
    """
    종합 점수(가중 평균) 계산
    - 결측 축은 가중치를 재분배(있는 축만 합산)
    - conf(신뢰도)는 단순 가용성 마스크로만 사용(고도화 가능)

    여러 음성 특성 점수를 결합해 하나의 종합 점수(VQS 등)로 산출할 때 사용
    """
    w_sum, acc = 0.0, 0.0
    for k, w in weights.items():
        if scores.get(k) is not None and conf.get(k, 0.0) > 0.0:
            acc += scores[k] * w
            w_sum += w
    if w_sum == 0.0:
        return 0.0
    return float(acc / w_sum) / 5.0  # 0~1 반환


def coalesce(x: Optional[float], default: Optional[float] = None) -> Optional[float]:
    """None을 기본값으로 치환"""
    return x if x is not None else default


def score_audio_axes(
    metrics: Dict,
) -> Tuple[Dict[str, float], Dict[str, float], float, List[str]]:
    """
    10축(0~5) 점수 + 축별 conf + 종합 VQS(0~100) + flags 반환
    - 임계치는 서비스 론칭 후 집단 데이터로 재보정 권장
    """
    flags: List[str] = []

    aq = metrics["audio_quality"]
    timing = metrics["timing"]
    prosody = metrics["prosody"]
    flu = metrics["fluency"]
    bp = metrics["breath_phrase"]
    arti = metrics.get("articulation", {})

    # ---- Audio hygiene (SNR/클리핑/리버브) ----
    snr_db = aq.get("snr_db", None)
    clip_pct = aq.get("clipping_pct", 0.0)
    reverb_level = aq.get("reverb_level", "unknown")
    # SNR: 10dB->0, 20dB->5
    snr_score = (
        None
        if snr_db is None
        else float(np.clip((snr_db - 10.0) / 10.0 * 5.0, 0.0, 5.0))
    )
    # 클리핑: 1%->0, 0.1%->5
    clip_score = linear_score(clip_pct, 1.0, 0.1, invert=True)
    audio_hygiene = blend([snr_score, clip_score], weights=[2 / 3, 1 / 3])
    if reverb_level == "high":
        audio_hygiene = max(0.0, (audio_hygiene or 0.0) - 0.5)
        flags.append("reverb_high")
    if snr_db is not None and snr_db < 10:
        flags.append("snr_low")
    if clip_pct >= 1.0:
        flags.append("clipping_high")

    # ---- Volume stability ----
    st_sd = aq.get("lufs_short_term_sd", None)
    volume_stability = linear_score(st_sd, 2.5, 1.0, invert=True)  # 낮을수록 좋음

    # ---- Pause hygiene ----
    max_pause = timing.get("max_pause_sec", None)
    silence_ratio = timing.get("silence_ratio", None)
    pause_hygiene = blend(
        [
            linear_score(max_pause, 3.0, 1.5, invert=True),
            linear_score(silence_ratio, 0.35, 0.15, invert=True),
        ],
        weights=[0.6, 0.4],
    )

    # ---- Pace control ----
    pace_sd = timing.get("pace", {}).get("stability_sd", None)
    art_rate = timing.get("pace", {}).get("articulation_rate", None)
    pace_control = blend(
        [
            linear_score(pace_sd, 35.0, 10.0, invert=True),  # 변동 적을수록 좋음
            linear_score(art_rate, 2.2, 4.0),  # 2.2->0, 4.0->5 (예시)
        ]
    )

    # ---- Intonation range ----
    f0_range = prosody.get("f0_range_hz", None)
    upspeak_ratio = prosody.get("upspeak_ratio", None)
    intonation_range = blend(
        [
            linear_score(f0_range, 60.0, 160.0),  # 범위 넓을수록 좋음
            linear_score(upspeak_ratio, 0.6, 0.15, invert=True),  # 업스픽 적을수록 좋음
        ]
    )

    # ---- Articulation clarity ----
    sibil = arti.get("sibilance_idx", None)
    plos = arti.get("plosive_idx", None)
    articulation_clarity = None
    if sibil is not None and plos is not None:
        articulation_clarity = np.clip(
            5.0 * (1.0 - (0.7 * sibil + 0.3 * plos)), 0.0, 5.0
        ).item()

    # ---- Fluency ----
    vbpm = flu.get("voice_breaks_per_min", None)
    fluency = linear_score(vbpm, 4.0, 0.5, invert=True)  # 적을수록 좋음

    # ---- Filler control ----
    filler_control = None  # STT 연동 시 채움음/min으로 치환

    # ---- Breath control ----
    avg_phrase = bp.get("avg_phrase_sec", None)
    phrase_sd = bp.get("phrase_len_sd", None)
    # 목표 τ≈6s, 편차와 분산이 작을수록 좋음
    comp1 = (
        None
        if avg_phrase is None
        else linear_score(abs(avg_phrase - 6.0), 9.0, 1.0, invert=True)
    )
    comp2 = linear_score(phrase_sd, 4.0, 1.5, invert=True)
    breath_control = blend([comp1, comp2])

    # ---- Confidence tone ----
    end_gain_drop = prosody.get("end_gain_drop_db", None)  # TODO: 필요 시 계산 추가
    comp_ct1 = linear_score(upspeak_ratio, 0.6, 0.15, invert=True)
    comp_ct2 = (
        linear_score(end_gain_drop, -6.0, -1.0) if end_gain_drop is not None else None
    )
    confidence_tone = blend([comp_ct1, comp_ct2], weights=[2 / 3, 1 / 3])

    scores = {
        "pace_control": coalesce(pace_control),
        "pause_hygiene": coalesce(pause_hygiene),
        "intonation_range": coalesce(intonation_range),
        "volume_stability": coalesce(volume_stability),
        "articulation_clarity": coalesce(articulation_clarity),
        "fluency": coalesce(fluency),
        "filler_control": coalesce(filler_control, default=None),
        "breath_control": coalesce(breath_control),
        "confidence_tone": coalesce(confidence_tone),
        "audio_hygiene": coalesce(audio_hygiene),
    }

    # 축별 신뢰도(conf): 현재는 단순 가용성 기반(고도화 가능)
    conf = {k: (1.0 if v is not None else 0.0) for k, v in scores.items()}

    # 종합 점수(VQS) = 가중 평균 × 20 (0~100)
    weights = {
        "audio_hygiene": 0.15,
        "volume_stability": 0.12,
        "pace_control": 0.12,
        "pause_hygiene": 0.10,
        "intonation_range": 0.10,
        "articulation_clarity": 0.10,
        "fluency": 0.08,
        "breath_control": 0.08,
        "confidence_tone": 0.08,
        "filler_control": 0.07,
    }
    vqs = weighted_score(scores, weights, conf) * 20.0
    return scores, conf, float(round(vqs, 1)), flags


# ------------------------------------------------------------------
# 메인 분석 진입점
# ------------------------------------------------------------------


def analyze_audio(
    input_data: Union[str, bytes, np.ndarray], sr: Optional[int] = None
) -> Dict:
    """
    오디오 전용 면접 음성 분석
    - input_data: 파일 경로, WAV 바이트, 또는 파형 ndarray(sr 필요)
    - 반환: 지표/점수/타임라인을 포함한 JSON(dict)
    """
    # 1) 로드 및 표준화
    if isinstance(input_data, str):
        y, sr0 = sf.read(input_data, dtype="float32", always_2d=False)
        if isinstance(y, np.ndarray) and y.ndim == 2:
            y = y.mean(axis=1).astype(np.float32)
        y, sr = to_mono_16k(np.asarray(y, dtype=np.float32), sr0)
    elif isinstance(input_data, bytes):
        y, sr0 = sf.read(io.BytesIO(input_data), dtype="float32", always_2d=False)
        if isinstance(y, np.ndarray) and y.ndim == 2:
            y = y.mean(axis=1).astype(np.float32)
        y, sr = to_mono_16k(np.asarray(y, dtype=np.float32), sr0)
    elif isinstance(input_data, np.ndarray):
        if sr is None:
            raise ValueError("ndarray 입력 시 sr(샘플레이트)을 명시해야 합니다.")
        y, sr = to_mono_16k(np.asarray(input_data, dtype=np.float32), sr)
    else:
        raise TypeError(
            "지원하지 않는 입력 타입입니다. path, bytes, numpy array 중 하나를 사용하세요."
        )

    dur = float(len(y) / sr)

    # 2) 거의 무음인 경우 빠른 종료
    if np.mean(y**2) < 1e-6 or np.mean(np.abs(y)) < 1e-3:
        return {
            "audio_quality": {"silence_all": True},
            "timing": {"duration_sec": dur, "speech_ratio": 0.0, "silence_ratio": 1.0},
            "prosody": {},
            "fluency": {},
            "breath_phrase": {},
            "scores": {
                k: 0
                for k in [
                    "pace_control",
                    "pause_hygiene",
                    "intonation_range",
                    "volume_stability",
                    "articulation_clarity",
                    "fluency",
                    "filler_control",
                    "breath_control",
                    "confidence_tone",
                    "audio_hygiene",
                ]
            },
            "conf": {
                k: 0
                for k in [
                    "pace_control",
                    "pause_hygiene",
                    "intonation_range",
                    "volume_stability",
                    "articulation_clarity",
                    "fluency",
                    "filler_control",
                    "breath_control",
                    "confidence_tone",
                    "audio_hygiene",
                ]
            },
            "vqs": 0.0,
            "flags": ["silence_all"],
        }

    # 3) 라우드니스/클리핑
    loud = compute_loudness(y, sr)
    clip_pct = compute_clipping_pct(y)
    loud["clipping_pct"] = float(round(clip_pct, 4))

    # VAD 전처리
    y_for_vad = y / (np.max(np.abs(y)) + 1e-12)
    y_for_vad = librosa.effects.preemphasis(y_for_vad, coef=0.97)

    # 4) VAD 세그먼트 & 타이밍
    # segments = run_vad_segments(y, sr, mode=2, frame_ms=20)
    # timing = compute_timing_metrics(segments, dur)

    segments = run_vad_segments(y_for_vad, sr, mode=1, frame_ms=20)
    timing = compute_timing_metrics(segments, dur)

    # 5) 에너지/스펙트럼 트랙
    tracks = compute_energy_tracks(y, sr)

    # 6) SNR 및 리버브 근사
    snr_db = compute_snr_db(y, sr, segments)
    audio_quality = {
        **loud,
        "snr_db": None if snr_db is None else float(round(snr_db, 2)),
        "reverb_level": estimate_reverb_level(y, sr, segments),
    }

    # 7) 피치/억양
    pit = compute_pitch(y, sr)
    f0_stats = f0_summary(pit["f0"])
    upspeak = compute_upspeak_ratio(pit["times"], pit["f0"], segments)
    prosody = {
        **{k: v for k, v in f0_stats.items() if v is not None},
        "upspeak_ratio": upspeak,
        "volume_stability": volume_stability_from_lufs_sd(
            loud.get("lufs_short_term_sd")
        ),
    }

    # 8) 유창성(voice breaks/min)
    vbpm = voice_breaks_per_min(pit["times"], pit["f0"], segments)
    fluency = {"voice_breaks_per_min": float(round(vbpm, 2))}

    # 9) 호흡/프레이즈
    breath_phrase = compute_breath_and_phrases(y, sr, segments, tracks)

    # 10) 발음 품질 프록시(치찰/플로시브)
    articulation = compute_articulation_indices(y, sr, tracks)

    # 11) 타임라인 구성(클라 시각화용)
    timeline = new_build_timeline(segments, tracks, pit)

    # 12) 모든 지표 합치기
    metrics = {
        "audio_quality": audio_quality,
        "timing": add_pace_stats(timing, y, sr),  # STT 없는 속도 프록시 추가
        "prosody": prosody,
        "fluency": fluency,
        "breath_phrase": breath_phrase,
        "articulation": articulation,
        "timeline": timeline,
    }

    # 13) 점수화 + 종합점수 + 플래그
    scores, conf, vqs, flags = score_audio_axes(metrics)
    metrics.update({"scores": scores, "conf": conf, "vqs": vqs, "flags": flags})
    return metrics


def estimate_reverb_level(
    y: np.ndarray, sr: int, segments: List[Tuple[float, float, str]]
) -> str:
    """
    리버브 레벨(경량 휴리스틱)
    - 온셋 강도(envelope)의 변조 스펙트럼 평탄도(m_flat)로 대략 분류
    - 정밀 RT60 추정이 필요하면 대체 알고리즘으로 교체하세요.
    """
    env = librosa.onset.onset_strength(y=y, sr=sr)
    if len(env) < 8:
        return "unknown"
    m_spec = np.abs(np.fft.rfft(env))
    m_flat = np.exp(np.mean(np.log(m_spec + 1e-12))) / (np.mean(m_spec + 1e-12) + 1e-12)
    if m_flat > 0.9:
        return "high"
    if m_flat > 0.75:
        return "medium"
    return "low"


def add_pace_stats(
    timing: Dict[str, float], y: np.ndarray, sr: int
) -> Dict[str, float]:
    """
    STT 없이 속도 프록시 추가
    - onset_strength 피크 밀도로 articulation_rate 근사
    - 5초 창별 속도 변동 표준편차로 stability_sd 산출
    """
    oenv = librosa.onset.onset_strength(y=y, sr=sr)
    peaks = librosa.util.peak_pick(
        oenv, pre_max=3, post_max=3, pre_avg=5, post_avg=5, delta=0.2, wait=5
    )
    speech_sec = float(timing["speech_ratio"] * timing["duration_sec"])
    per_sec = (len(peaks) / (speech_sec + 1e-6)) if speech_sec > 0 else 0.0
    articulation_rate = float(np.clip(per_sec / 2.0, 0.5, 5.0))  # 대략적 정규화
    # 5초 창별 피크율 표준편차 → 변동성
    win = int(5 * sr)
    rates = []
    for i in range(0, len(y) - win, win):
        seg = y[i : i + win]
        oe = librosa.onset.onset_strength(y=seg, sr=sr)
        pk = librosa.util.peak_pick(
            oe, pre_max=3, post_max=3, pre_avg=5, post_avg=5, delta=0.2, wait=5
        )
        rates.append(len(pk) / 5.0)
    pace_sd = float(np.std(rates)) if len(rates) >= 2 else 0.0
    timing["pace"] = {
        "wpm": None,  # STT 단어수 기반 계산 시 채우기
        "articulation_rate": float(round(articulation_rate, 2)),
        "stability_sd": float(round(pace_sd * 10, 1)),  # 가독성 스케일
    }
    return timing


def _downsample_arrays(max_points, *arrs, decimals=3):
    L = len(arrs[0])
    if not max_points or L <= max_points:
        return [np.round(a, decimals).tolist() for a in arrs]
    step = int(np.ceil(L / max_points))
    sl = slice(0, L, step)
    return [np.round(a[sl], decimals).tolist() for a in arrs]


def new_build_timeline(segments, tracks, pit, max_points=1200, decimals=3):
    t, rms = tracks["times"], tracks["rms"]
    f0 = pit["f0"]
    t_ds, rms_ds, f0_ds = _downsample_arrays(max_points, t, rms, f0, decimals=decimals)
    return {
        "segments": [
            {"start": float(s), "end": float(e), "type": t} for s, e, t in segments
        ],
        "events": [],
        "tracks": {"time": t_ds, "rms": rms_ds, "f0": f0_ds},
    }


def build_timeline(
    segments: List[Tuple[float, float, str]],
    tracks: Dict[str, np.ndarray],
    pit: Dict[str, np.ndarray],
) -> Dict:
    """
    타임라인 JSON
    - 클라이언트에서 바로 그래프로 그릴 수 있는 형태
    """
    return {
        "segments": [
            {"start": float(s), "end": float(e), "type": t} for s, e, t in segments
        ],
        "events": [],  # TODO: breath/voice_break/loud_peak 등 상세 이벤트 추가 가능
        "tracks": {
            "time": tracks["times"].tolist(),
            "rms": tracks["rms"].tolist(),
            "f0": pit["f0"].tolist(),
        },
    }


# ------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="면접 음성(내용 제외) 분석기")
    parser.add_argument("audio", help="오디오 파일 경로(wav/webm/mp3 등).")
    parser.add_argument("--json-out", help="결과 JSON을 저장할 경로.", default=None)
    args = parser.parse_args()
    metrics = analyze_audio(args.audio)
    txt = json.dumps(metrics, ensure_ascii=False, indent=2)
    print(txt)
    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as f:
            f.write(txt)


base = Path(__file__).parent if "__file__" in globals() else Path.cwd()
file_path = (base / "mu4.wav").resolve()

m = analyze_audio(str(file_path))

print("duration:", m["timing"]["duration_sec"])
print(
    "speech_ratio:",
    m["timing"]["speech_ratio"],
    "max_pause:",
    m["timing"]["max_pause_sec"],
)
print("snr_db:", m["audio_quality"].get("snr_db"))
print("first segments:", m["timeline"]["segments"][:5])
