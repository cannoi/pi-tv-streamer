FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache wget curl

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY . .

RUN mkdir -p /app/data /app/media \
  && addgroup -S app && adduser -S app -G app \
  && chown -R app:app /app

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0

# Smoke tests often run without overriding user — non-root is fine if data is writable
USER app

EXPOSE 8080

# Prefer curl/wget against 127.0.0.1 (container loopback)
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=10 \
  CMD wget -qO- http://127.0.0.1:8080/health || curl -fsS http://127.0.0.1:8080/health || exit 1

CMD ["node", "server.js"]
