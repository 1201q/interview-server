from flask import Flask, request, jsonify, send_file
from dotenv import load_dotenv
import os, tempfile
from werkzeug.utils import secure_filename
from urllib.parse import urljoin

from convert import *
from analysis_functions import *
from transcribe import transcribe_whisper
from analysis import analyze_audio
from io import BytesIO
import threading

import librosa
import numpy as np

import tempfile, os, requests

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
NEST_URL = os.getenv("NEST_URL", "http://localhost:8000")
webhook_url = urljoin(NEST_URL, "/analysis/webhook")


def process_in_background(file_bytes: bytes, filename: str, question_id: str):
    with tempfile.TemporaryDirectory() as tmpdir:
        webm_path = os.path.join(tmpdir, filename)
        wav_path = os.path.join(tmpdir, "converted.wav")

        with open(webm_path, "wb") as f:
            f.write(file_bytes)

        ######## 1. webm -> wav 변환
        convert_webm_to_wav(webm_path, wav_path)

        ######## 2. 무음인지를 판단함.
        # 무음이라고 판단되면 바로 에러 반환
        if is_audio_silent(wav_path):
            print("무음으로 판단됨. 분석 생략")
            requests.post(
                webhook_url,
                json={
                    "message": "무음으로 분석되어 판단하지 않음.",
                    "code": "silent",
                    "status": "fail",
                    "question_id": question_id,
                },
            )
            return

        ######## 3. 3초 미만이라고 판단되면 바로 에러 반환
        if get_audio_duration(wav_path) < 3:
            print("3초 미만이라고 판단됨. 분석 생략")
            requests.post(
                webhook_url,
                json={
                    "message": "3초 미만은 분석할 수 없음.",
                    "code": "too_short",
                    "status": "fail",
                    "question_id": question_id,
                },
            )
            return

        ######## 4. STT 진행
        transcript = transcribe_whisper(wav_path)

        ######## 5. STT가 정상적인 STT 실행했는지를 판단함.
        # 3초 미만이라고 판단되면 바로 에러 반환
        if not is_valid_transcription(transcript):
            print("분석 불가: 무음 또는 너무 짧음")
            requests.post(
                webhook_url,
                json={
                    "message": "무음 또는 너무 짧아 판단하지 않음.",
                    "code": "stt_error",
                    "status": "fail",
                    "question_id": question_id,
                },
            )
            return

        try:
            print(transcript)

            requests.post(
                webhook_url,
                json={
                    "message": "분석 성공.",
                    "code": "analysis_success",
                    "status": "success",
                    "question_id": question_id,
                    "result": transcript,
                },
            )
        except Exception as e:
            print(e)
            requests.post(
                webhook_url,
                json={
                    "message": str(e),
                    "code": "analysis_error",
                    "status": "fail",
                    "question_id": question_id,
                },
            )
