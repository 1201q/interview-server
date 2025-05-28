
FROM mambaorg/micromamba:1.4.3 AS builder


SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN micromamba create -n ml-env \
    -c conda-forge \
    python=3.10 \
    praat-parselmouth \
    flask \
    gunicorn \
    python-dotenv \
    requests \
    numpy \
    librosa \
    -y && \
    micromamba clean --all --yes


RUN echo "source /opt/conda/etc/profile.d/conda.sh && conda activate ml-env" >> ~/.bashrc


WORKDIR /app
COPY . .


# 2) Runtime: 슬림 파이썬 이미지에 복사
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app


COPY --from=builder /opt/conda/envs/ml-env /opt/conda/envs/ml-env

ENV PATH=/opt/conda/envs/ml-env/bin:$PATH


COPY --from=builder /app /app

EXPOSE 5000
CMD ["gunicorn", "main:app", "--bind", "0.0.0.0:5000"]
