FROM python:3.10-slim

# 기본 설정
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    build-essential \
    ninja-build \
    ffmpeg \
    libsndfile1 \
    libasound2 \
    libglib2.0-0 \
    libffi-dev \
    git \
    && wget https://github.com/Kitware/CMake/releases/download/v3.26.4/cmake-3.26.4-linux-aarch64.tar.gz \
    && tar -xzf cmake-3.26.4-linux-aarch64.tar.gz \
    && mv cmake-3.26.4-linux-aarch64 /opt/cmake \
    && ln -s /opt/cmake/bin/cmake /usr/local/bin/cmake \
    && rm cmake-3.26.4-linux-aarch64.tar.gz


COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["gunicorn", "main:app", "--bind", "0.0.0.0:5000"]