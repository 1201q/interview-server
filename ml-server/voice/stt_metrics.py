# stt_metrics.py
import json, math
from pathlib import Path
from typing import Dict, List, Tuple


# ----- 유틸 -----
def _merge_intervals(iv: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
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


def _duration(iv: List[Tuple[float, float]]) -> float:
    return sum(max(0.0, e - s) for s, e in iv)


def _rolling_wpm(words: List[Tuple[float, float, str]], win=5.0, step=0.5):
    # 간단한 슬라이딩 윈도우 WPM (단어 수 / 60 * (60/win) = 단어/분)
    if not words:
        return 0.0, 0.0
    t0 = words[0][0]
    t1 = words[-1][1]
    ts = []
    t = t0
    i = 0
    while t <= t1:
        # 윈도우 [t, t+win)
        wcount = 0
        while i < len(words) and words[i][1] < t:
            i += 1
        j = i
        while j < len(words) and words[j][0] < t + win:
            wcount += 1
            j += 1
        wpm = (wcount / win) * 60.0
        ts.append(wpm)
        t += step
    if not ts:
        return 0.0, 0.0
    mean = sum(ts) / len(ts)
    sd = (sum((x - mean) ** 2 for x in ts) / max(1, len(ts) - 1)) ** 0.5
    return mean, sd


# ----- Whisper/4o STT JSON 파서 -----
def _extract_words(data: Dict) -> List[Tuple[float, float, str, float]]:
    """
    다양한 포맷을 최대한 흡수:
    - whisper-1 verbose_json: result['segments'][i]['words'][j]['start'|'end'|'word']
    - 4o(-mini)-transcribe: result['words'] 리스트
    """
    words = []
    # 4o 스타일
    if isinstance(data.get("words"), list):
        for w in data["words"]:
            s, e = float(w.get("start", 0)), float(w.get("end", 0))
            txt = (w.get("word") or w.get("text") or "").strip()
            conf = float(w.get("confidence", 1.0))
            if e > s:
                words.append((s, e, txt, conf))
    # whisper 스타일(segments -> words)
    if not words and isinstance(data.get("segments"), list):
        for seg in data["segments"]:
            for w in seg.get("words", []):
                s, e = float(w.get("start", 0)), float(w.get("end", 0))
                txt = (w.get("word") or w.get("text") or "").strip()
                conf = float(w.get("confidence", 1.0))
                if e > s:
                    words.append((s, e, txt, conf))
    # 마지막 방어: segments 자체의 time만이라도
    if not words and isinstance(data.get("segments"), list):
        for seg in data["segments"]:
            s, e = float(seg.get("start", 0)), float(seg.get("end", 0))
            if e > s:
                words.append((s, e, seg.get("text", "").strip(), 1.0))
    return sorted(words, key=lambda x: (x[0], x[1]))


def _extract_sentences(data: Dict) -> List[Tuple[float, float, str]]:
    # 4o 스타일
    if isinstance(data.get("segments"), list) and all(
        "start" in s and "end" in s for s in data["segments"]
    ):
        return [
            (float(s["start"]), float(s["end"]), s.get("text", "").strip())
            for s in data["segments"]
            if s.get("end", 0) > s.get("start", 0)
        ]
    # whisper verbose_json에 sentences가 따로 없는 경우가 많아 segments로 대체
    return []


# ----- 메인 지표 -----
def stt_metrics_from_file(
    json_path: Path, audio_duration_sec: float | None = None
) -> Dict:
    data = json.loads(Path(json_path).read_text(encoding="utf-8"))

    words = _extract_words(data)  # (start, end, text, conf)
    sentences = _extract_sentences(data)  # (start, end, text)

    if not words:
        return {
            "file_id": json_path.stem,
            "duration_sec": audio_duration_sec or 0.0,
            "speaking_ratio_stt": 0.0,
            "start_latency_sec": audio_duration_sec or 0.0,
            "max_pause_sec": audio_duration_sec or 0.0,
            "long_pause_count": 0,
            "long_pause_total_sec": 0.0,
            "wpm_mean": 0.0,
            "wpm_sd": 0.0,
            "sentence_count": len(sentences),
            "avg_sentence_sec": 0.0,
            "sentence_sd": 0.0,
            "mean_confidence": None,
        }

    # 총 길이
    if audio_duration_sec is None:
        # whisper verbose_json은 duration이 없을 수 있으니 words 끝으로 추정(+여유 0.0)
        duration = max(words[-1][1], max((s[1] for s in sentences), default=0.0))
    else:
        duration = float(audio_duration_sec)

    # 단어 구간 합집합
    intervals = _merge_intervals([(s, e) for (s, e, _, _) in words])
    speaking = _duration(intervals)
    speaking_ratio = speaking / max(1e-6, duration)

    # 시작 지연, 최장/장기 침묵
    start_latency = words[0][0]
    gaps = []
    for i in range(len(words) - 1):
        gaps.append(max(0.0, words[i + 1][0] - words[i][1]))
    max_pause = max(gaps) if gaps else (duration - words[-1][1])
    long_pauses = [g for g in gaps if g >= 1.5]
    long_pause_total = sum(long_pauses)

    # WPM(5s 창)
    wpm_mean, wpm_sd = _rolling_wpm(
        [(s, e, t) for (s, e, t, _) in words], win=5.0, step=0.5
    )

    # 문장 길이 통계
    sent_durs = [max(0.0, e - s) for (s, e, _) in sentences] if sentences else []
    if sent_durs:
        avg_sent = sum(sent_durs) / len(sent_durs)
        var = sum((x - avg_sent) ** 2 for x in sent_durs) / max(1, len(sent_durs) - 1)
        sent_sd = var**0.5
    else:
        avg_sent, sent_sd = 0.0, 0.0

    # 평균 confidence
    confs = [c for *_, c in words if isinstance(c, (int, float))]
    mean_conf = (sum(confs) / len(confs)) if confs else None

    return {
        "file_id": json_path.stem,
        "duration_sec": round(duration, 3),
        "speaking_ratio_stt": round(speaking_ratio, 4),
        "start_latency_sec": round(start_latency, 3),
        "max_pause_sec": round(max_pause, 3),
        "long_pause_count": len(long_pauses),
        "long_pause_total_sec": round(long_pause_total, 3),
        "wpm_mean": round(wpm_mean, 1),
        "wpm_sd": round(wpm_sd, 1),
        "sentence_count": len(sentences),
        "avg_sentence_sec": round(avg_sent, 2),
        "sentence_sd": round(sent_sd, 2),
        "mean_confidence": None if mean_conf is None else round(float(mean_conf), 3),
    }
