FROM python:3.10-slim AS builder

# 기본 설정
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    libasound2 \
    libglib2.0-0 \
    libffi-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    cmake \ 
    python3-dev \ 
    libsndfile1-dev \
    libglib2.0-dev \
    pkg-config && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --upgrade pip
RUN pip install --no-cache-dir praat-parselmouth
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 
# 

FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.10/site-packages \
    /usr/local/lib/python3.10/site-packages

COPY --from=builder /app /app

EXPOSE 5000

CMD ["gunicorn", "main:app", "--bind", "0.0.0.0:5000"]