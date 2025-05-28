import librosa
from pydub import AudioSegment, silence
import numpy as np


# 0.01 이상이면 무음이라고 판단. //
def is_audio_silent(wav_path, threshold=0.01):
    y, sr = librosa.load(wav_path, sr=None)
    rms = np.sqrt(np.mean(y**2))
    print(rms)
    return rms < threshold


def is_valid_transcription(
    transcript: dict, min_text_length: int = 5, no_speech_threshold: float = 0.6
):
    if len(transcript.get("text", "").strip()) < min_text_length:
        return False

    segments = transcript.get("segments", [])
    if not segments:
        return False

    if all(seg.get("no_speech_prob", 0) > no_speech_threshold for seg in segments):
        return False

    return True


# 어절 수 계산
def get_count_words(text: str):
    return len(text.split())


# 발화 시간 계산
def get_audio_duration(file_path: str):
    y, sr = librosa.load(file_path, sr=None)
    return librosa.get_duration(y=y, sr=sr)


# 말 속도 계산
def get_speech_speed(num_words: int, duration: float):
    return num_words / duration if duration else 0.0


# 평균 볼륨 rms db
def get_rms_volume(file_path: str):
    y, sr = librosa.load(file_path, sr=None)
    rms = librosa.feature.rms(y=y)[0]
    return float(20 * np.log10(np.mean(rms)))


# 전체 평균 데시벨 dBFS
def get_avg_volume_dBFS(file_path: str):
    audio = AudioSegment.from_wav(file_path)
    return float(audio.dBFS)


# 침묵 구간 총합
def get_silence_stats(file_path: str):
    audio = AudioSegment.from_wav(file_path)
    chunks = silence.detect_silence(
        audio, min_silence_len=1000, silence_thresh=audio.dBFS - 16
    )

    count = len(chunks)
    total_sec = sum((end - start) for start, end in chunks) / 1000
    return int(count), float(round(total_sec, 2))


# 피치 분석
# def get_pitch_features(file_path: str):
#     sound = parselmouth.Sound(file_path)
#     pitch = sound.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=500)
#     pitches = pitch.selected_array['frequency']
#     valid_pitches = [p for p in pitches if p > 0]

#     avg = float(np.mean(valid_pitches))
#     min_val = float(np.min(valid_pitches))
#     max_val = float(np.max(valid_pitches))
#     std = float(np.std(valid_pitches))
#     pitch_range = float(max_val - min_val)

#     return avg, min_val, max_val, std, pitch_range
