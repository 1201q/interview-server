FROM mambaorg/micromamba:1.4.3 AS builder

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN micromamba create -n ml-env \
    -c conda-forge \        
    -c ets \                
    python=3.10 \
    flask \
    gunicorn \
    python-dotenv \
    requests \
    numpy \
    librosa \
    ffmpeg \
    py-webrtcvad \
    ets::praat-parselmouth \
    -y

WORKDIR /app
COPY requirements.txt .
RUN micromamba run -n ml-env pip install -r requirements.txt && \
    micromamba clean --all --yes

COPY . .

FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app


COPY --from=builder /opt/conda/envs/ml-env /opt/conda/envs/ml-env
ENV PATH=/opt/conda/envs/ml-env/bin:$PATH


COPY --from=builder /app /app

EXPOSE 5000
CMD ["gunicorn", "main:app", "--bind", "0.0.0.0:5000"]
