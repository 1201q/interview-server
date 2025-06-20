from flask import Flask, request, jsonify, send_file
from dotenv import load_dotenv
import os, tempfile
from werkzeug.utils import secure_filename
from urllib.parse import urljoin

from convert import *
from transcribe import transcribe_whisper
from analysis import analyze_audio
from io import BytesIO
import threading
import pdfplumber

from analysis_main import *
import io
import tempfile, os

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

app = Flask(__name__)
NEST_URL = os.getenv("NEST_URL", "http://localhost:8000")
webhook_url = urljoin(NEST_URL, "/analysis/webhook")


@app.route("/")
def hello():
    py_test = os.getenv("PY_TEST", "값 없음")
    return f" PY_TEST 환경변수  : {py_test}"


@app.route("/wow")
def test():
    return f"wow"


@app.route("/stt", methods=["POST"])
def stt():
    file = request.files["file"]
    filename = secure_filename(file.filename)

    with tempfile.TemporaryDirectory() as tmpdir:
        webm_path = os.path.join(tmpdir, filename)
        wav_path = os.path.join(tmpdir, "converted.wav")

        file.save(webm_path)

        convert_webm_to_wav(webm_path, wav_path)
        transcript = transcribe_whisper(wav_path)

        return jsonify(
            {
                "transcript": transcript,
            }
        )


@app.route("/process_audio", methods=["POST"])
def process_audio():
    file = request.files["file"]
    filename = secure_filename(file.filename)

    with tempfile.TemporaryDirectory() as tmpdir:
        webm_path = os.path.join(tmpdir, filename)
        wav_path = os.path.join(tmpdir, "converted.wav")

        file.save(webm_path)

        convert_webm_to_wav(webm_path, wav_path)
        transcript = transcribe_whisper(wav_path)

        print(transcript)
        analysis = analyze_audio(wav_path, transcript["text"], transcript["duration"])

        return jsonify({"transcript": transcript, "analysis": analysis})


@app.route("/analyze_answer", methods=["POST"])
def analyze_answer():
    file = request.files["file"]
    question_id = str(request.form["question_id"])
    question_text = str(request.form["question_text"])
    job_role = str(request.form["job_role"])
    filename = secure_filename(file.filename)
    file_bytes = file.read()

    print(question_text)

    threading.Thread(
        target=new_process_in_background,
        args=(file_bytes, filename, question_id, question_text, job_role),
    ).start()

    return jsonify({"status": "processing"}), 202


# webm -> seekable webm으로 변환
@app.route("/convert_seekable", methods=["POST"])
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


@app.route("/extract_text", methods=["POST"])
def extract_text():
    file = request.files.get("file")
    if not file:
        return jsonify({"message": "파일 없음"}), 400

    print(file)

    try:
        text = ""
        with pdfplumber.open(io.BytesIO(file.read())) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"

        return jsonify({"result": text.strip()})
    except Exception as e:
        return jsonify({"message": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
