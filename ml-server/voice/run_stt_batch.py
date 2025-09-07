# run_stt_batch.py
import csv
from pathlib import Path
from stt_metrics import stt_metrics_from_file

JSON_DIR = Path(__file__).parent / "json"
OUT_CSV = Path(__file__).parent / "stt_metrics.csv"


def main():
    rows = []
    for p in sorted(JSON_DIR.glob("*.json")):
        m = stt_metrics_from_file(
            p
        )  # duration을 STT로 추정. 필요하면 실제 길이 넣어도 됨.
        rows.append(m)

    if not rows:
        print("No JSON found in ./json")
        return

    # 컬럼 순서 고정
    cols = [
        "file_id",
        "duration_sec",
        "speaking_ratio_stt",
        "start_latency_sec",
        "max_pause_sec",
        "long_pause_count",
        "long_pause_total_sec",
        "wpm_mean",
        "wpm_sd",
        "sentence_count",
        "avg_sentence_sec",
        "sentence_sd",
        "mean_confidence",
    ]

    with OUT_CSV.open("w", newline="", encoding="utf-8") as w:
        writer = csv.DictWriter(w, fieldnames=cols)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Saved: {OUT_CSV} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
