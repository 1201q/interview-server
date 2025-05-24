FROM python:3.10-slim

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


COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["gunicorn", "main:app", "--bind", "0.0.0.0:5000"]