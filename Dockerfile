FROM node:20-alpine
WORKDIR /app

# Runtime deps for healthcheck
RUN apk add --no-cache wget

RUN addgroup -S app && adduser -S app -G app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund \
  && npm cache clean --force

COPY . .

RUN mkdir -p /app/data /app/media \
  && chown -R app:app /app

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0

USER app
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1

CMD ["node", "server.js"]
