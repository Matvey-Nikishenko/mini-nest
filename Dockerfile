# Той самий базовий образ, що в ДЗ #5 (node:22-slim).
# `docker compose run --rm api npm test` виконується на стадії builder,
# де є devDependencies (typescript, @types/node).

FROM node:22-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY test ./test

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

USER node
CMD ["node", "--eval", "console.log('mini-nest part-1: IoC only, no HTTP server yet')"]
