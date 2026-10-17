FROM node:24-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
# npm ci = persis sesuai lockfile (tak diam-diam naik versi); gagal kalau lockfile tak sinkron dengan package.json.
RUN npm ci
COPY . .
RUN npx prisma generate
ARG NODE_HEAP_MB=1280
ENV NODE_OPTIONS=--max-old-space-size=$NODE_HEAP_MB
RUN npm run build

FROM node:24-alpine AS runner
RUN apk add --no-cache openssl tini
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
# Tanpa devDependencies (Nest CLI dll) → image lebih kecil, pull deploy lebih cepat. `prisma` (CLI migrate deploy) ada di
# dependencies. NODE_ENV di-set SETELAH install (Gotcha: NODE_ENV=production saat install diam-diam melewati devDeps).
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force
ENV NODE_ENV=production
# Tanpa telemetri/cek update Prisma saat start (panggilan jaringan yang tak perlu).
ENV CHECKPOINT_DISABLE=1
COPY --from=builder /app/dist ./dist

# Bukan root: bila ada RCE, penyerang tak langsung root di kontainer. File app milik root & read-only bagi user node.
USER node
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main"]
