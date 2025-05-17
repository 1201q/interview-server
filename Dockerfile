FROM node:20.11.1-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

FROM node:20.11.1-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

RUN apk add --no-cache tzdata
ENV TZ=Asia/Seoul

EXPOSE 8000
CMD ["npm", "run", "start:prod"]