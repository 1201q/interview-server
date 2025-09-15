import subprocess
from pydub import AudioSegment
from io import BytesIO


def convert_webm_to_wav(webm_path: str, wav_path: str):
    subprocess.run(
        [
            "ffmpeg",
            "-i",
            webm_path,
            "-ar",
            "16000",
            "-ac",
            "1",
            "-f",
            "wav",
            wav_path,
            "-y",
        ],
        check=True,
    )


def convert_to_seekable_webm(webm_path: str, output_path: str):
    subprocess.run(
        ["ffmpeg", "-i", webm_path, "-c:a", "copy", "-fflags", "+genpts", output_path],
        check=True,
    )


def webm_to_wav_bytes(webm_bytes: bytes) -> bytes:
    # webm → AudioSegment
    audio = AudioSegment.from_file(BytesIO(webm_bytes), format="webm")
    # wav로 export
    buf = BytesIO()
    audio.export(buf, format="wav")
    return buf.getvalue()
