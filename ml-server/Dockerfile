
# ---------- builder ----------
FROM python:3.10-slim AS builder
WORKDIR /app

# pip 캐시 경로
ENV PIP_CACHE_DIR=/root/.cache/pip

# (A) 런타임에 필요한 OS 라이브러리 설치
RUN --mount=type=cache,target=/var/cache/apt/archives,id=apt-archives-builder,sharing=locked \
    set -eux; \
    mkdir -p /var/cache/apt/archives/partial; \
    rm -f /var/cache/apt/archives/lock /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock || true; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
    ffmpeg libsndfile1 libsoxr0; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

# (B) 최신 pip/setuptools/wheel (aarch64 manylinux 인식 개선)
RUN python -m pip install --upgrade pip setuptools wheel

# (C) 의존성 고정 파일만 먼저 복사해서 레이어 캐시 안정화
COPY requirements.txt .

# (D) wheelhouse는 "이미지에 커밋"되는 디렉토리(← 중요)
RUN mkdir -p /wheelhouse

# (E) 모든 의존성 휠 생성 (다운로드 캐시는 mount에 저장)
RUN --mount=type=cache,target=/root/.cache/pip \
    pip wheel --only-binary=:all: -r requirements.txt -w /wheelhouse

# ---------- runtime ----------
FROM python:3.10-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OPENBLAS_NUM_THREADS=1 \
    OMP_NUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1

# (F) 런타임 OS 라이브러리 설치 (apt 캐시만 mount)
RUN --mount=type=cache,target=/var/cache/apt/archives,id=apt-archives-runtime,sharing=locked \
    set -eux; \
    mkdir -p /var/cache/apt/archives/partial; \
    rm -f /var/cache/apt/archives/lock /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock || true; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
    ffmpeg libsndfile1 libsoxr0; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

# (G) 오프라인 설치: wheelhouse는 이미지에 이미 포함됨
COPY --from=builder /wheelhouse /wheelhouse
COPY requirements.txt .
RUN pip install --no-index --find-links=/wheelhouse -r requirements.txt \
    && rm -rf /wheelhouse

# (H) 앱 소스는 마지막에 복사 (의존성 레이어 재사용)
COPY . .

EXPOSE 5000

CMD ["gunicorn","main:app","--bind","0.0.0.0:5000","--workers","2","--worker-class","sync","--threads","1","--timeout","120","--graceful-timeout","30","--max-requests","400","--max-requests-jitter","60"]
