FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# npm ci = persis sesuai lockfile (tak diam-diam naik versi).
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ARG NODE_HEAP_MB=1280
ENV NODE_OPTIONS=--max-old-space-size=$NODE_HEAP_MB
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Dengarkan semua interface (Docker mengisi HOSTNAME = id kontainer).
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Next menulis cache (gambar/ISR) di .next/cache → folder .next milik user node; sisanya read-only.
RUN mkdir -p .next/cache && chown -R node:node .next/cache

USER node
EXPOSE 3000
# tini = PID 1: SIGTERM diteruskan (stop/deploy cepat, bukan menunggu 10 dtk lalu di-kill).
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
