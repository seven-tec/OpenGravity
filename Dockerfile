FROM golang:1.24-bookworm AS gog-builder
RUN CGO_ENABLED=0 go install github.com/steipete/gogcli/cmd/gog@latest

FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:20-slim

WORKDIR /app

# Instalar ffmpeg para procesamiento de audio y ca-certificates
RUN apt-get update && apt-get install -y ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*

# Copiar el binario de gog desde el builder de Go
COPY --from=gog-builder /go/bin/gog /usr/local/bin/gog

# Asegurar que el usuario node (UID 1000) sea el dueño del directorio de trabajo
RUN chown -R node:node /app

USER node

COPY --chown=node:node package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --chown=node:node --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=7860

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:7860/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
