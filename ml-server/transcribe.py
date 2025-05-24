import openai
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

open_api_key = os.getenv("OPENAI_API_KEY")
client = openai.OpenAI(api_key=open_api_key)

def transcribe_whisper(wav_path: str):
  with open(wav_path, "rb") as f:
    transcript = client.audio.transcriptions.create(
      model='whisper-1',
      file=f,
      response_format='verbose_json',
      language='ko',
      timestamp_granularities=["word", "segment"]
    )
  return transcript.model_dump()