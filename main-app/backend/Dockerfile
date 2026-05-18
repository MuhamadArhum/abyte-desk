FROM node:20-alpine

RUN apk add --no-cache mariadb-client

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p backups logs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/v1/ping || exit 1

CMD ["node", "server.js"]
