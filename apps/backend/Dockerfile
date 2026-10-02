FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npx prisma generate
ENV NODE_OPTIONS=--max-old-space-size=1280
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl tini
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install && npx prisma generate
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist

EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main"]
