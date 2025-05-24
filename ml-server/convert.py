import subprocess

def convert_webm_to_wav(webm_path: str, wav_path: str):
    subprocess.run([
        "ffmpeg", "-i", webm_path,
        "-ar", "16000", "-ac", "1",
        "-f", "wav", wav_path, "-y"
    ], check=True)