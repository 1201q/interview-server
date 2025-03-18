FROM node:20-alpine AS builder

RUN mkdir -p /app
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build


FROM node:20-alpine
RUN mkdir -p /app
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY --from=builder /app/dist ./dist

RUN apk add --update tzdata
ENV TZ=Asia/Seoul

EXPOSE 8000
CMD ["npm", "run", "start:prod"]