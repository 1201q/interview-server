FROM mambaorg/micromamba:1.4.3 AS builder
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

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
    -y && \
    micromamba clean --all --yes

WORKDIR /app
COPY requirements.txt .

# 📦 pip 캐시를 BuildKit cache로 유지해서 재빌드 가속
RUN --mount=type=cache,id=pip-ml-env,target=/home/mambauser/.cache/pip \
    micromamba run -n ml-env pip install -r requirements.txt

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