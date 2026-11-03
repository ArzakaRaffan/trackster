FROM node:22-alpine

WORKDIR /app

COPY --chown=node:node server.mjs ./server.mjs
COPY --chown=node:node public ./public

RUN mkdir -p /data && chown node:node /data

USER node

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_PATH=/data/status.json

EXPOSE 3000

CMD ["node", "server.mjs"]
