from flask import Flask, request, jsonify, send_file
from dotenv import load_dotenv
import os, tempfile
from werkzeug.utils import secure_filename
from urllib.parse import urljoin
from convert import *

from io import BytesIO
from core_filler import faster_run_filler_analysis_bytes

from functools import lru_cache
import tensorflow as tf

import tempfile, os
import fitz
import pymupdf4llm
import traceback
from pathlib import Path

from redis import Redis
from rq import Queue

from tasks import analyze_voice


# 최초 환경변수 로드
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

BASE_DIR = Path(__file__).resolve().parent

app = Flask(__name__)
NEST_URL = os.getenv("NEST_URL", "http://localhost:8000")


# model
DEFAULT_MODEL = BASE_DIR / "model" / "new_filler_determine_model.h5"
model_path = str(DEFAULT_MODEL)

# 큐
RQ_URL = os.getenv("RQ_REDIS_URL", "redis://localhost:6379/1")
redis_conn = Redis.from_url(RQ_URL)
q_audio = Queue("audio", connection=redis_conn)


@lru_cache(maxsize=2)
def load_filler_model(model_path: str):
    return tf.keras.models.load_model(model_path)


@app.get("/")
def hello():
    py_test = os.getenv("PY_TEST", "값 없음")
    return f" PY_TEST 환경변수  : {py_test}"


@app.get("/routes")
def routes():
    return {
        "routes": [
            {"rule": str(r.rule), "methods": list(r.methods)}
            for r in app.url_map.iter_rules()
        ]
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/health/queue")
def health_queue_check():
    try:
        redis_conn.ping()
        return {"status": "ok"}, 200
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500


@app.post("/audio/enqueue")
def enqueue_audio():
    data = request.get_json(force=True) or {}

    print(data)

    job = q_audio.enqueue(
        analyze_voice,
        data["analysis_id"],
        data["audio_url"],
        data["callback_url"],
        job_timeout=600,
        result_ttl=60 * 60,
        failure_ttl=60 * 60 * 24,
    )
    return jsonify({"jobId": job.id, "status": job.get_status()}), 202


@app.post("/voice_metrics")
def voice_metrics():
    audio_bytes = None

    if "audio" in request.files:
        f = request.files["audio"]
        audio_bytes = f.read()
        mimetype = f.mimetype
    else:
        audio_bytes = request.get_data()
        mimetype = request.content_type or "application/octet-stream"

    if not audio_bytes:
        return jsonify({"error": "오디오 데이터가 없습니다."}), 400

    def _ensure_wav(audio_bytes: bytes, mimetype: str) -> bytes:
        if mimetype in ("audio/wav", "audio/x-wav"):
            # 이미 WAV면 그대로 사용
            return audio_bytes
        elif mimetype in ("audio/webm", "video/webm"):
            # webm → wav 변환
            return webm_to_wav_bytes(audio_bytes)
        else:
            raise ValueError(f"지원하지 않는 오디오 형식: {mimetype}")

    try:
        wav_bytes = _ensure_wav(audio_bytes, mimetype)
    except Exception as e:
        app.logger.exception("webm 변환 실패")
        return jsonify({"error": "webm→wav 변환 실패", "msg": str(e)}), 500

    segmentation = request.args.get("segmentation", "adaptive")

    params = None
    if request.is_json:
        body = request.get_json(silent=True) or {}
        params = body.get("params")

    model = load_filler_model(model_path)

    try:
        result = faster_run_filler_analysis_bytes(
            audio_bytes=wav_bytes,
            model=model,
            segmentation=segmentation,
            params=params,
        )
        return jsonify(result)
    except Exception as e:
        app.logger.exception("voice_metrics error")
        return jsonify({"error": "서버 내부 오류", "msg": str(e)}), 500


# webm -> seekable webm으로 변환
@app.post("/convert_seekable")
def convert_seekable():
    file = request.files["file"]

    if not file:
        return jsonify({"error": "파일이 없습니다."}), 400

    filename = secure_filename(file.filename)

    with tempfile.TemporaryDirectory() as tmpdir:
        webm_path = os.path.join(tmpdir, filename)
        output_path = os.path.join(tmpdir, "converted.webm")
        file.save(webm_path)

        try:
            convert_to_seekable_webm(webm_path, output_path)

            with open(output_path, "rb") as f:
                data = BytesIO(f.read())

            return send_file(data, mimetype="audio/webm", as_attachment=False)

        except subprocess.CalledProcessError as e:
            return jsonify({"error": "변환 실패", "msg": str(e)}), 500
        except Exception as e:
            return jsonify({"error": "서버 내부 오류", "msg": str(e)}), 500


# pdf에서 텍스트 추출
@app.post("/extract_text")
def extract_text():
    file = request.files.get("file")
    if not file:
        return jsonify({"message": "파일 없음"}), 400

    try:
        raw_data = file.read()
        pdf = fitz.open(stream=raw_data, filetype="pdf")

        md_text = pymupdf4llm.to_markdown(pdf)
        print(md_text)

        markdown_text = ""
        for i, page in enumerate(pdf):
            try:
                page_text = page.get_text("markdown")
            except Exception as e:
                print(f"[WARN] markdown 추출 실패 - fallback to text: {e}")
                page_text = page.get_text("text")
            if page_text:
                markdown_text += page_text + "\n"

        return jsonify({"result": md_text.strip(), "fallback": markdown_text.strip()})
    except Exception as e:

        traceback.print_exc()
        return jsonify({"message": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
