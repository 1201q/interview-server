FROM mambaorg/micromamba:1.4.3 AS builder
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# C 확장 빌드를 위한 툴체인 (webrtcvad pip 빌드용)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 네이티브 바이너리는 conda, 파이썬 패키지는 pip로
RUN micromamba create -n ml-env \
    -c conda-forge \
    --strict-channel-priority \
    python=3.10 \
    pip \
    flask \
    gunicorn \
    python-dotenv \
    requests \
    ffmpeg \
    libsndfile \
    soxr \
    -y

WORKDIR /app
COPY requirements.txt .

RUN micromamba run -n ml-env pip install --no-cache-dir -r requirements.txt && \
    micromamba clean --all --yes

COPY . .

# ---- Runtime layer ----
FROM python:3.10-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app


COPY --from=builder /opt/conda/envs/ml-env /opt/conda/envs/ml-env
ENV PATH=/opt/conda/envs/ml-env/bin:$PATH

ENV LD_LIBRARY_PATH=/opt/conda/envs/ml-env/lib

COPY --from=builder /app /app

EXPOSE 5000
CMD ["gunicorn", "main:app", "--bind", "0.0.0.0:5000"]
