# tasks.py
import os
import io
import time
import json
import logging
import tempfile
from typing import Optional, Dict, Any
import requests

from rq import get_current_job
from convert import webm_to_wav_bytes
from core_filler import faster_run_filler_analysis_bytes

from functools import lru_cache
import tensorflow as tf
from pathlib import Path

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

BASE_DIR = Path(__file__).resolve().parent

WEBM_TYPES = {"audio/webm", "video/webm"}
WAV_TYPES = {"audio/wav", "audio/x-wav"}

# 모델
# model
DEFAULT_MODEL = BASE_DIR / "model" / "new_filler_determine_model.h5"
MODEL_PATH = str(DEFAULT_MODEL)

_MODEL = None


@lru_cache(maxsize=2)
def load_filler_model(model_path: str):
    return tf.keras.models.load_model(model_path)


def _get_model():
    global _MODEL
    if _MODEL is None:
        logger.info("[tasks] loading filler model: %s", MODEL_PATH)
        _MODEL = load_filler_model(MODEL_PATH)
        logger.info("[tasks] model loaded")
    return _MODEL


def _ensure_wav(audio_bytes: bytes, content_type: Optional[str]) -> bytes:
    ctype = (content_type or "").split(";")[0].strip().lower()
    if ctype in WAV_TYPES:
        return audio_bytes
    if ctype in WEBM_TYPES:
        return webm_to_wav_bytes(audio_bytes)
    raise ValueError(f"Unsupported audio content-type: {content_type}")


def _download_audio_with_retries(url: str, *, max_retries: int = 3, timeout: int = 30):
    """
    presigned/PAR URL에서 오디오를 다운로드. 일시 오류는 지수 백오프로 재시도.
    return: (bytes, content_type)
    """
    delay = 2
    last_error = None

    for attempt in range(1, max_retries + 1):
        try:
            with requests.get(url, stream=True, timeout=timeout) as r:
                r.raise_for_status()
                content_type = r.headers.get("Content-Type", "application/octet-stream")
                buf = io.BytesIO()

                for chunk in r.iter_content(chunk_size=262_144):
                    if chunk:
                        buf.write(chunk)
                return buf.getvalue(), content_type
        except Exception as e:
            last_error = e
            logger.warning(
                "[tasks] download failed (attempt %d/%d): %s", attempt, max_retries, e
            )
            if attempt < max_retries:
                time.sleep(delay)
                delay *= 2
    raise RuntimeError(f"audio download failed: {last_error}")


def _post_callback_with_retries(
    url: str, payload: Dict[str, Any], *, max_retries: int = 3, timeout: int = 10
) -> None:
    headers = {"Content-Type": "application/json"}

    delay = 2
    last_error = None

    for attempt in range(1, max_retries + 1):
        try:
            r = requests.post(
                url, data=json.dumps(payload), headers=headers, timeout=timeout
            )
            if 200 <= r.status_code < 300:
                return

            if 400 <= r.status_code < 500 and r.status_code not in (
                408,
                409,
                425,
                429,
                499,
            ):
                raise RuntimeError(f"callback failed: {r.status_code} {r.text}")
            raise RuntimeError(f"callback failed: {r.status_code} {r.text}")
        except Exception as e:
            last_error = e
            logger.warning(
                "[tasks] callback failed (attempt %d/%d): %s", attempt, max_retries, e
            )
            if attempt < max_retries:
                time.sleep(delay)
                delay *= 2
    raise RuntimeError(f"callback failed: {last_error}")


def analyze_voice(
    analysis_id: str,
    audio_url: str,
    callback_url: str,
    *,
    segmentation: str = "adaptive",
    params: Optional[Dict[str, Any]] = None,
):
    """
    1) presigned audio_url 다운로드
    2) webm -> wav 변환
    3) 모델 분석
    4) Nest 콜백으로 결과 전달

    RQ에서 호출되므로 반환값은 문자열/간단 객체면 충분.
    """
    job = get_current_job()
    jprefix = f"[job {job.id}]" if job else "[job]"
    logger.info("%s analyze_audio start (analysis_id=%s)", jprefix, analysis_id)

    audio_bytes, content_type = _download_audio_with_retries(audio_url)
    logger.info(
        "%s audio downloaded: %d bytes, content-type=%s",
        jprefix,
        len(audio_bytes),
        content_type,
    )

    try:
        wav_bytes = _ensure_wav(audio_bytes, content_type)
    except Exception as e:
        logger.exception("%s audio conversion failed: %s", jprefix, e)

        _post_callback_with_retries(
            callback_url,
            {
                "analysisId": analysis_id,
                "error": "webm_to_wav_failed",
                "message": str(e),
            },
        )
        raise

    try:
        model = _get_model()
        result = faster_run_filler_analysis_bytes(
            audio_bytes=wav_bytes, model=model, segmentation=segmentation, params=params
        )

        payload = {"analysisId": analysis_id, "result": result}
        _post_callback_with_retries(callback_url, payload)
        logger.info("%s analysis completed and callback posted", jprefix)
        return "ok"
    except Exception as e:
        logger.exception("%s analysis failed: %s", jprefix, e)

        try:
            _post_callback_with_retries(
                callback_url,
                {
                    "analysisId": analysis_id,
                    "error": "voice_metrics_failed",
                    "message": str(e),
                },
            )
        except Exception:
            logger.exception("%s callback-after-error failed", jprefix)
        raise
