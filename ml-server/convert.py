import subprocess


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
