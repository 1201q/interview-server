from flask import Flask, request, jsonify, send_file
from dotenv import load_dotenv
import os, tempfile
from werkzeug.utils import secure_filename

from convert import *
from transcribe import transcribe_whisper
from analysis import analyze_audio
from io import BytesIO

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

app = Flask(__name__)

@app.route('/')
def hello():
  py_test = os.getenv("PY_TEST", "값 없음")
  return f' PY_TEST 환경변수  : {py_test}'

@app.route('/wow')
def test():
  return f'wow'

@app.route('/process_audio', methods=["POST"])
def process_audio():
  file = request.files["file"]
  filename = secure_filename(file.filename)

  with tempfile.TemporaryDirectory() as tmpdir:
    webm_path = os.path.join(tmpdir, filename)
    wav_path = os.path.join(tmpdir, "converted.wav")

    file.save(webm_path)

    convert_webm_to_wav(webm_path, wav_path)
    transcript = transcribe_whisper(wav_path)
    analysis = analyze_audio(wav_path, transcript["text"], transcript["duration"])

    return jsonify({
      "transcript" : transcript,
      "analysis" : analysis
    })

@app.route('/convert_seekable', methods=['POST'])
def convert_seekable():
  file = request.files["file"]
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
      return jsonify({"error" : "변환 실패", "msg" : str(e)}), 500


if __name__ == "__main__":
  app.run(host='0.0.0.0', port=5000)