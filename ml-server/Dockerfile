FROM mambaorg/micromamba:1.4.3 AS builder
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
WORKDIR /app

# conda/pip 캐시 경로 고정
ENV PIP_CACHE_DIR=/opt/pipcache

COPY requirements.txt .

# conda 환경 생성 (conda pkgs 캐시)
RUN --mount=type=cache,target=/opt/conda/pkgs \
    micromamba create -n ml-env -c conda-forge --strict-channel-priority \
    python=3.10 pip flask gunicorn python-dotenv requests ffmpeg libsndfile soxr -y

# wheel 미리 다운로드 (pip 캐시 + wheel 폴더 캐시)
RUN --mount=type=cache,target=/opt/conda/pkgs \
    --mount=type=cache,target=/opt/pipcache \
    --mount=type=cache,target=/wheels \
    micromamba run -n ml-env pip wheel -r requirements.txt -w /wheels

# wheel로 설치
RUN --mount=type=cache,target=/opt/conda/pkgs \
    --mount=type=cache,target=/opt/pipcache \
    micromamba run -n ml-env pip install --no-index --find-links=/wheels -r requirements.txt

COPY . .

# ------------------ RUNTIME ------------------
FROM python:3.10-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app


COPY --from=builder /opt/conda/envs/ml-env /opt/conda/envs/ml-env
ENV PATH=/opt/conda/envs/ml-env/bin:$PATH
ENV LD_LIBRARY_PATH=/opt/conda/envs/ml-env/lib

COPY --from=builder /app /app

EXPOSE 5000

ENV OPENBLAS_NUM_THREADS=1 \
    OMP_NUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1 \
    NUMBA_NUM_THREADS=1 \
    TF_NUM_INTRAOP_THREADS=1 \
    TF_NUM_INTEROP_THREADS=1


CMD ["gunicorn", "main:app", "--bind", "0.0.0.0:5000", \
    "--workers", "2", "--worker-class", "sync", "--threads", "1", \
    "--timeout", "120", "--graceful-timeout", "30", \
    "--max-requests", "400", "--max-requests-jitter", "60"]