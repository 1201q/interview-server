from analysis_functions import *

def analyze_audio(wav_path:str, text:str, duration:float):
  word_count = get_count_words(text)

  return {
    "duration" : duration,
    "word_count" : word_count,
    "speech_speed" : get_speech_speed(word_count, duration),
    "avg_volume_rms" : get_rms_volume(wav_path),
    "avg_volume_dbfs" : get_avg_volume_dBFS(wav_path),
    "silence_count" : get_silence_stats(wav_path)[0],
    "silence_total_sec" : get_silence_stats(wav_path)[1],
    # "pitch" : get_pitch_features(wav_path)
  }