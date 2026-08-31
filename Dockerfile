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
CMD ["node", "dist/src/server.js"]
