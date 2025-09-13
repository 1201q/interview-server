from typing import List, Tuple
import io
import numpy as np
import librosa
import webrtcvad
from pydub import AudioSegment
from pydub.silence import detect_nonsilent
import numpy as np

TARGET_SR = 16000
TARGET_CH = 1
TARGET_SW = 2  # 16-bit

SILENCE_THRESH_DBFS = -35.0
MIN_SIL_MS = 120

# -------------------- Model params --------------------
FILLER_IDX = 0
THR = 0.72  # ↑ 살짝 상향

# -------------------- VAD / context filters --------------------
USE_VAD = True
VAD_AGGR = 2
VAD_FRAME_MS = 20
VAD_REQ_RATIO = 0.45  # 유성 비율 55% 이상만 통과

USE_QUIET_CONTEXT = True  # ★ 켜기
CTX_PRE_MS = 150
CTX_POST_MS = 150
CTX_THRESH_DBFS = -32.0  # 앞/뒤 120ms 중 하나가 이보다 조용해야 통과

# -------------------- windowing --------------------
WIN_MS = 320
HOP_MS = 80
MIN_MS = 100
MAX_MS = 1200

# -------------------- NMS params --------------------
USE_NMS = True
NMS_IOU = 0.55
STRICT_PASS = 0.85
NEIGHBOR_SUPPORT_THR = 0.68
NEIGHBOR_IOU_MIN = 0.25


ENERGY_USE = True
ENERGY_CENTER_MS = 160  # 윈도우 중앙부 길이
ENERGY_EDGE_MS = 80  # 앞/뒤 비교 구간 길이
ENERGY_MARGIN_DB = 2.0  # 중앙이 앞/뒤보다 최소 이만큼 커야 통과


def ensure_format(seg: AudioSegment) -> AudioSegment:
    return (
        seg.set_frame_rate(TARGET_SR)
        .set_channels(TARGET_CH)
        .set_sample_width(TARGET_SW)
    )


def _iter_pcm_frames(seg: AudioSegment, frame_ms: int):
    assert frame_ms in (10, 20, 30), "webrtcvad는 10/20/30ms 프레임만 지원"
    pcm = ensure_format(seg).raw_data
    bytes_per_sample = 2
    samples_per_frame = int(TARGET_SR * frame_ms / 1000)
    step_bytes = samples_per_frame * bytes_per_sample
    t = 0
    for i in range(0, len(pcm) - step_bytes + 1, step_bytes):
        yield t, t + frame_ms, pcm[i : i + step_bytes]
        t += frame_ms


def detect_speech_intervals_vad(
    audio: AudioSegment,
    frame_ms: int,  # 10/20/30만 가능
    aggr: int,  # 0(느슨)~3(엄격)
    min_speech_ms: int,  # 이보다 짧은 구간은 제거
    hangover_ms: int,  # 말끝 무음 허용(꼬리 달기)
    max_merge_gap_ms: int,  # 가까운 구간 병합
):
    vad = webrtcvad.Vad(aggr)
    frames = list(_iter_pcm_frames(audio, frame_ms))
    if not frames:
        return []

    # 상태기계 + hangover(무음 몇 프레임은 발화 유지)
    active = False
    cur_start = None
    silent_run = 0
    hangover_frames = max(1, hangover_ms // frame_ms)
    min_frames = max(1, min_speech_ms // frame_ms)

    ivs = []
    for fs, fe, raw in frames:
        is_speech = vad.is_speech(raw, TARGET_SR)
        if is_speech:
            silent_run = 0
            if not active:
                active = True
                cur_start = fs
        else:
            if active:
                silent_run += 1
                # hangover_frames 까지는 발화 유지
                if silent_run > hangover_frames:
                    # 종료
                    if (fe - cur_start) >= min_speech_ms:
                        ivs.append((cur_start, fe))
                    active = False
                    cur_start = None
                    silent_run = 0

    # 끝 처리(파일 끝까지 hangover 허용)
    if active:
        end_t = frames[-1][1]
        if (end_t - cur_start) >= min_speech_ms:
            ivs.append((cur_start, end_t))

    # 가까운 구간 병합
    merged = []
    for s, e in ivs:
        if not merged:
            merged.append([s, e])
            continue
        ps, pe = merged[-1]
        if s - pe <= max_merge_gap_ms:
            merged[-1][1] = max(pe, e)
        else:
            merged.append([s, e])
    return [(int(s), int(e)) for s, e in merged]


def detect_speech_intervals(audio: AudioSegment) -> List[Tuple[int, int]]:
    ivs = detect_nonsilent(
        audio, min_silence_len=MIN_SIL_MS, silence_thresh=SILENCE_THRESH_DBFS
    )
    return [(int(s), int(e)) for (s, e) in ivs]


def _frame_dbfs_series(audio: AudioSegment, frame_ms: int = 30) -> np.ndarray:
    step = int(frame_ms)
    vals = []
    for s in range(0, len(audio), step):
        seg = audio[s : min(len(audio), s + step)]
        db = seg.dBFS if seg.dBFS != float("-inf") else -100.0
        vals.append(db)
    return np.array(vals, dtype=np.float32)


def compute_adaptive_params(
    audio: AudioSegment,
    frame_ms: int = 30,
    noise_pct: float = 20.0,
    speech_pct: float = 95.0,
    sil_margin_db: float = 4.0,
    ctx_margin_db: float = 2.0,
):
    db = _frame_dbfs_series(audio, frame_ms)
    if db.size == 0:
        return {"silence_thresh": -35.0, "ctx_thresh": -38.0}

    noise_floor = np.percentile(db, noise_pct)  # 예: 하위 20% 지점
    speech_level = np.percentile(db, speech_pct)  # 예: 상위 95% 지점

    # 안전 클램프
    noise_floor = float(np.clip(noise_floor, -80.0, -20.0))
    speech_level = float(np.clip(speech_level, -40.0, 0.0))

    silence_thresh = noise_floor + sil_margin_db
    ctx_thresh = noise_floor + ctx_margin_db

    # 말소리보다 더 높게 가지 않도록(말소리와 구분 유지)
    silence_thresh = min(silence_thresh, speech_level - 3.0)
    ctx_thresh = min(ctx_thresh, speech_level - 6.0)

    # 최종 클램프
    silence_thresh = float(np.clip(silence_thresh, -70.0, -20.0))
    ctx_thresh = float(np.clip(ctx_thresh, -70.0, -20.0))

    return {
        "noise_floor": noise_floor,
        "speech_level": speech_level,
        "silence_thresh": silence_thresh,
        "ctx_thresh": ctx_thresh,
    }


def detect_speech_intervals_adaptive(
    audio: AudioSegment,
    frame_ms: int,
    enter_margin_db: float,
    exit_margin_db: float,
    min_speech_ms: int,
    min_sil_ms: int,
):
    p = compute_adaptive_params(audio, frame_ms=frame_ms)
    base = p["silence_thresh"]  # 진입 기준의 베이스
    enter_th = base + enter_margin_db  # 말소리로 '들어갈' 때 임계
    exit_th = base + exit_margin_db  # 말소리에서 '나올' 때 임계

    # 프레임 스캔
    step = frame_ms
    frames = []
    for s in range(0, len(audio), step):
        seg = audio[s : min(len(audio), s + step)]
        db = seg.dBFS if seg.dBFS != float("-inf") else -100.0
        frames.append((s, s + len(seg), db))
    if not frames:
        return []

    # 히스테리시스 + 최소길이 적용
    ivs = []
    in_speech = False
    cur_start = None
    last_change = 0
    for fs, fe, db in frames:
        if not in_speech:
            if db >= enter_th:
                in_speech = True
                cur_start = fs
                last_change = fs
        else:
            if db < exit_th:
                # 말소리 종료 후보
                if fe - cur_start >= min_speech_ms:
                    ivs.append((cur_start, fe))
                in_speech = False
                cur_start = None
                last_change = fe

    # 끝 처리
    if in_speech and (frames[-1][1] - cur_start >= min_speech_ms):
        ivs.append((cur_start, frames[-1][1]))

    # 너무 짧은 무음으로 쪼개진 구간 합치기(침묵 최소길이)
    merged = []
    for s, e in ivs:
        if not merged:
            merged.append([s, e])
            continue
        ps, pe = merged[-1]
        gap = s - pe
        if gap < min_sil_ms:
            merged[-1][1] = max(pe, e)
        else:
            merged.append([s, e])
    return [(int(s), int(e)) for s, e in merged]


#
def sliding_windows(s: int, e: int, win: int = WIN_MS, hop: int = HOP_MS):
    i = s
    while i < e:
        we = min(e, i + win)
        yield (i, we)
        if we >= e:
            break
        i += hop


def slice_ms(audio: AudioSegment, s: int, e: int) -> AudioSegment:
    s = max(0, s)
    e = min(len(audio), e)
    return audio[s:e]


def audio_to_pcm16(seg: AudioSegment) -> bytes:
    """Return raw 16k/mono/16bit little-endian PCM bytes."""
    seg = ensure_format(seg)
    buf = io.BytesIO()
    seg.export(buf, format="wav")
    wav = buf.getvalue()
    # strip wav header to raw PCM for VAD
    # (webrtcvad expects raw PCM)
    # but easier: use pydub's raw_data (already PCM)
    return seg.raw_data  # 16k/mono/16bit


def vad_voiced_ratio(seg: AudioSegment) -> float:
    """% of voiced frames by WebRTC VAD"""
    pcm = audio_to_pcm16(seg)
    vad = webrtcvad.Vad(VAD_AGGR)
    bytes_per_sample = 2
    sample_rate = TARGET_SR
    frame_len = int(sample_rate * VAD_FRAME_MS / 1000)  # samples
    step_bytes = frame_len * bytes_per_sample

    total = 0
    voiced = 0
    for i in range(0, len(pcm) - step_bytes + 1, step_bytes):
        frame = pcm[i : i + step_bytes]
        total += 1
        try:
            if vad.is_speech(frame, sample_rate):
                voiced += 1
        except Exception:
            # ignore malformed last chunk
            pass
    return (voiced / total) if total else 0.0


def is_quiet_context_adaptive(
    full: AudioSegment, s: int, e: int, pre_ms: int = 150, post_ms: int = 150
):
    p = compute_adaptive_params(full, frame_ms=30)
    ctx_th = p["ctx_thresh"]
    pre = full[max(0, s - pre_ms) : s]
    post = full[e : min(len(full), e + post_ms)]

    def quiet(seg):
        db = seg.dBFS if seg.dBFS != float("-inf") else -100.0
        return db <= ctx_th

    # 앞/뒤 둘 중 하나만 조용해도 인정하고 싶으면 or, 둘 다면 and
    return quiet(pre) or quiet(post)


# --- MFCC(20x40) for binary model ---
def pad2d(a: np.ndarray, t_len: int) -> np.ndarray:
    return (
        a[:, :t_len]
        if a.shape[1] > t_len
        else np.hstack((a, np.zeros((a.shape[0], t_len - a.shape[1]), dtype=a.dtype)))
    )


def extract_x(seg: AudioSegment) -> np.ndarray:
    # seg -> wav bytes -> librosa load
    buf = io.BytesIO()
    ensure_format(seg).export(buf, format="wav")
    y, _ = librosa.load(io.BytesIO(buf.getvalue()), sr=TARGET_SR, mono=True)
    mfcc = librosa.feature.mfcc(y=y, sr=TARGET_SR, n_mfcc=20)  # (20, T)
    feat = pad2d(mfcc, 40)  # (20, 40)
    x = np.expand_dims(feat, axis=(0, -1))  # (1, 20, 40, 1)
    return x


def iou(a: Tuple[int, int], b: Tuple[int, int]) -> float:
    s1, e1 = a
    s2, e2 = b
    inter = max(0, min(e1, e2) - max(s1, s2))
    union = (e1 - s1) + (e2 - s2) - inter
    return inter / union if union > 0 else 0.0


# -------------------------------------------
def rms_db(seg: AudioSegment) -> float:
    # 16-bit PCM 가정(TARGET_SW=2)
    a = np.frombuffer(seg.raw_data, dtype=np.int16).astype(np.float32)
    if seg.channels > 1:
        a = a.reshape(-1, seg.channels).mean(axis=1)
    if a.size == 0:
        return -100.0
    a /= 32768.0
    rms = np.sqrt(np.mean(a * a) + 1e-12)
    return 20.0 * np.log10(rms + 1e-12)


def energy_valley_ok(full: AudioSegment, s: int, e: int) -> bool:
    # 중앙 구간
    mid = s + (e - s) // 2
    c_s = max(s, mid - ENERGY_CENTER_MS // 2)
    c_e = min(e, mid + ENERGY_CENTER_MS // 2)
    center = slice_ms(full, c_s, c_e)

    # 앞/뒤 경계 구간
    pre = slice_ms(full, s - ENERGY_EDGE_MS, s)
    post = slice_ms(full, e, e + ENERGY_EDGE_MS)

    c_db = rms_db(center)
    pre_db = rms_db(pre)
    post_db = rms_db(post)

    # 중앙이 양쪽보다 MARIGIN 만큼 더 커야(=양옆이 더 조용해야) 추임새로 인정
    return (c_db >= pre_db + ENERGY_MARGIN_DB) or (c_db >= post_db + ENERGY_MARGIN_DB)
