from __future__ import annotations
from dataclasses import dataclass
from typing import List, Tuple, Dict, Any
import io
import numpy as np


from pydub import AudioSegment

import func_filler as ff


@dataclass
class Interval:
    s: int
    e: int


def merge_iv(iv: List[Tuple[int, int]]) -> List[Interval]:
    if not iv:
        return []
    iv = sorted(iv)
    out = [Interval(iv[0][0], iv[0][1])]
    for s, e in iv[1:]:
        last = out[-1]
        if s <= last.e:
            last.e = max(last.e, e)
        else:
            out.append(Interval(s, e))
    return out


def sum_iv(iv: List[Interval]) -> int:
    return sum(max(0, i.e - i.s) for i in iv)


def intersect_iv(a: Interval, b: Interval):
    s, e = max(a.s, b.s), min(a.e, b.e)
    return (s, e) if e > s else None


def subtract_iv(A: List[Interval], B: List[Interval]) -> List[Interval]:
    if not A:
        return []
    if not B:
        return A[:]
    B = merge_iv([(b.s, b.e) for b in B])
    out = []
    for a in A:
        cur = [(a.s, a.e)]
        for b in B:
            nxt = []
            for s, e in cur:
                inter = intersect_iv(Interval(s, e), b)
                if not inter:
                    nxt.append((s, e))
                else:
                    is_, ie_ = inter
                    if s < is_:
                        nxt.append((s, is_))
                    if ie_ < e:
                        nxt.append((ie_, e))
            cur = nxt
        out += [Interval(s, e) for s, e in cur]
    return out


def complement_iv(A: List[Interval], total_ms: int) -> List[Interval]:
    A = merge_iv([(i.s, i.e) for i in A])
    out = []
    cur = 0
    for i in A:
        if i.s > cur:
            out.append(Interval(cur, i.s))
        cur = max(cur, i.e)
    if cur < total_ms:
        out.append(Interval(cur, total_ms))
    return out


def run_filler_analysis_bytes(
    audio_bytes: bytes,
    model,
    segmentation: str = "adaptive",  # 'adaptive' | 'vad' | 'pydub'
    params: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    p = params or {}

    # 모델을 로드 + 피크 노멀라이즈
    full = AudioSegment.from_file(io.BytesIO(audio_bytes))
    gain = -1.0 - (full.max_dBFS if full.max_dBFS != float("-inf") else -1.0)
    full = full.apply_gain(gain)

    # 1. 전역 발화 구간
    if segmentation == "vad":
        speech_ivs_raw = ff.detect_speech_intervals_vad(
            full,
            frame_ms=p.get("vad_frame_ms", 20),  # 10/20/30 중 하나
            aggr=p.get("vad_aggr", 2),  # 0~3 (3이 더 엄격)
            min_speech_ms=p.get(
                "vad_min_speech_ms", 200
            ),  # 얼마나 잘게 쪼갤지 (200~250)
            hangover_ms=p.get(
                "vad_hangover_ms", 120
            ),  # 문장 꼬리 자연스럽게 붙임 (100~200)
            max_merge_gap_ms=p.get("vad_merge_gap_ms", 120),
        )
    elif segmentation == "pydub":
        speech_ivs_raw = ff.detect_speech_intervals(full)
    else:
        speech_ivs_raw = ff.detect_speech_intervals_adaptive(
            full,
            frame_ms=p.get("adaptive_frame_ms", 30),
            enter_margin_db=p.get("adaptive_enter_db", 6.0),
            exit_margin_db=p.get("adaptive_exit_db", 3.0),
            min_speech_ms=p.get("adaptive_min_speech_ms", 150),
            min_sil_ms=p.get("adaptive_min_sil_ms", 120),
        )

    speech_iv = merge_iv(speech_ivs_raw)

    # 2. 윈도윙 + 후보 필터 + 추론
    drop = {"too_short_long": 0, "vad": 0, "context": 0, "low_prob": 0}
    if ff.ENERGY_USE:
        drop["energy_valley"] = 0
    total_windows = 0
    rows = []

    for s, e in [(i.s, i.e) for i in speech_iv]:
        for ws, we in ff.sliding_windows(s, e):
            total_windows += 1
            seg = ff.slice_ms(full, ws, we)
            dur = len(seg)

            if dur < ff.MIN_MS or dur > ff.MAX_MS:
                drop["too_short_long"] += 1
                continue
            if ff.USE_VAD:
                if ff.vad_voiced_ratio(seg) < ff.VAD_REQ_RATIO:
                    drop["vad"] += 1
                    continue
            if ff.USE_QUIET_CONTEXT and not ff.is_quiet_context_adaptive(full, ws, we):
                drop["context"] += 1
                continue
            if ff.ENERGY_USE and (not ff.energy_valley_ok(full, ws, we)):
                drop["energy_valley"] += 1
                continue

            x = ff.extract_x(seg)
            p0 = float(model.predict(x, verbose=0)[0][ff.FILLER_IDX])

            if p0 >= ff.THR:
                rows.append({"s": ws, "e": we, "dur_ms": dur, "p": round(p0, 6)})
            else:
                drop["low_prob"] += 1

    # 3. neighbor merge
    def _has_support(c, pool) -> bool:
        for d in pool:
            if d is c:
                continue
            if (
                ff.iou((c["s"], c["e"]), (d["s"], d["e"])) >= ff.NEIGHBOR_IOU_MIN
                and d["p"] >= ff.NEIGHBOR_SUPPORT_THR
            ):
                return True
        return False

    cands = rows
    tmp = []
    for c in cands:
        if c["p"] >= ff.STRICT_PASS or _has_support(c, cands):
            tmp.append(c)
    cands = tmp
    cands = sorted(cands, key=lambda r: r["p"], reverse=True)
    kept = []
    for c in cands:
        if all(ff.iou((c["s"], c["e"]), (k["s"], k["e"])) < ff.NMS_IOU for k in kept):
            kept.append(c)

    def _merge_kept(kept: list[dict], max_gap: int = 80) -> list[dict]:
        if not kept:
            return kept
        kept = sorted(kept, key=lambda r: (r["s"], r["e"]))
        out = [dict(kept[0])]
        for c in kept[1:]:
            last = out[-1]
            # 겹치거나, gap이 max_gap 이하이면 합치기
            if c["s"] <= last["e"] + max_gap:
                last["e"] = max(last["e"], c["e"])
                last["dur_ms"] = last["e"] - last["s"]
                last["p"] = max(last["p"], c["p"])  # 최고 확률 유지
            else:
                out.append(dict(c))
        return out

    kept = _merge_kept(kept, max_gap=80)
    filler_iv = merge_iv([(r["s"], r["e"]) for r in kept])

    # 4. 집계
    T = len(full)

    speech_ms = sum_iv(speech_iv)
    filler_ms = sum_iv(filler_iv)
    speech_wo_filler_iv = subtract_iv(speech_iv, filler_iv)  # speech - filler
    speech_wo_filler_ms = sum_iv(speech_wo_filler_iv)
    silence_iv = complement_iv(speech_iv, T)
    silence_ms = sum_iv(silence_iv)

    silence_per_speech = (silence_ms / speech_ms) if speech_ms > 0 else 0.0
    sil_plus_filler_per_speech_wo_filler = (
        (silence_ms + filler_ms) / speech_wo_filler_ms
        if speech_wo_filler_ms > 0
        else float("inf")
    )

    return {
        "duration_ms": T,
        "speech_ms": speech_ms,
        "silence_ms": silence_ms,
        "filler_ms": filler_ms,
        "speech_wo_filler_ms": speech_wo_filler_ms,
        "ratios": {
            "silence_per_speech": silence_per_speech,
            "silence_plus_filler_per_speech_wo_filler": sil_plus_filler_per_speech_wo_filler,
        },
        "intervals": {
            "speech": [{"s": i.s, "e": i.e} for i in speech_iv],
            "filler": [{"s": i.s, "e": i.e} for i in filler_iv],
            "silence": [{"s": i.s, "e": i.e} for i in silence_iv],
            "speech_wo_filler": [{"s": i.s, "e": i.e} for i in speech_wo_filler_iv],
        },
        "diag": {
            "total_windows": total_windows,
            "drops": drop,
            "pre_nms_candidates": len(rows),
            "post_nms_kept": len(kept),
            "segmentation_mode": segmentation,
        },
    }
