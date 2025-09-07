from openai import OpenAI
import os
from dotenv import load_dotenv
import json
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm

base_dir = os.path.dirname(__file__)
env_path = os.path.abspath(os.path.join(base_dir, "..", ".env"))

load_dotenv(dotenv_path=env_path)
open_api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=open_api_key)


def transcribe_main(
    audio_path: str,
    out_path: str = None,
    model: str = "whisper-1",
    language: str = "ko",
    response_format: str = "verbose_json",
):
    with open(audio_path, "rb") as f:
        kwargs = dict(
            model=model, file=f, response_format=response_format, language=language
        )

        if model == "whisper-1":
            kwargs["timestamp_granularities"] = ["segment", "word"]

        result = client.audio.transcriptions.create(**kwargs)

    data = result.model_dump()

    base = os.path.splitext(os.path.basename(audio_path))[0]
    out_dir = os.path.join(os.path.dirname(audio_path), "..", "json")
    out_dir = os.path.abspath(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{base}.json")

    with open(out_path, "w", encoding="utf-8") as w:
        json.dump(data, w, ensure_ascii=False, indent=2)

    return out_path


def transcribe_to_json(filename: str):
    fp = os.path.join(base_dir, "wav", filename)
    fp = os.path.abspath(fp)
    out = transcribe_main(fp)
    print("저장됨", out)


# transcribe_to_json("broswer.wav")
