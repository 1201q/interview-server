from flask import Flask, request, jsonify, send_file
from dotenv import load_dotenv
import os, tempfile
from werkzeug.utils import secure_filename
from urllib.parse import urljoin

from convert import *

from io import BytesIO

from analysis_main import *
import tempfile, os
import fitz
import traceback


load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

app = Flask(__name__)
NEST_URL = os.getenv("NEST_URL", "http://localhost:8000")
webhook_url = urljoin(NEST_URL, "/analysis/webhook")


@app.route("/")
def hello():
    py_test = os.getenv("PY_TEST", "값 없음")
    return f" PY_TEST 환경변수  : {py_test}"


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

    try:
        raw_data = file.read()
        pdf = fitz.open(stream=raw_data, filetype="pdf")

        markdown_text = ""
        for i, page in enumerate(pdf):
            try:
                page_text = page.get_text("markdown")
            except Exception as e:
                print(f"[WARN] markdown 추출 실패 - fallback to text: {e}")
                page_text = page.get_text("text")
            if page_text:
                markdown_text += page_text + "\n"

        return jsonify({"result": markdown_text.strip()})
    except Exception as e:

        traceback.print_exc()
        return jsonify({"message": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
