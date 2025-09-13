# 1) deps (개발 의존성 포함) — 캐시 최대화
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 2) build (dist 생성)
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine
WORKDIR /app

RUN apk add --update tzdata
ENV TZ=Asia/Seoul

# 필요한 것만 복사
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder   /app/dist         ./dist
COPY package*.json ./

EXPOSE 8000
CMD ["npm", "run", "start:prod"]