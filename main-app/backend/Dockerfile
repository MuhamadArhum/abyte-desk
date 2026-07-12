# ── Stage 1: dependency installer ────────────────────────────
FROM node:20-alpine AS deps

RUN apk add --no-cache python3 make g++   # native addons (bcrypt, sharp)

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts=false && npm cache clean --force


# ── Stage 2: minimal production image ────────────────────────
FROM node:20-alpine AS production

# Runtime tools (mariadb-client for backup dumps, dumb-init for signal forwarding)
RUN apk add --no-cache mariadb-client dumb-init && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only production node_modules from deps stage
COPY --from=deps --chown=appuser:appgroup /app/node_modules ./node_modules

# Copy application source (excludes everything in .dockerignore)
COPY --chown=appuser:appgroup . .

# Create writable directories; set strict permissions
RUN mkdir -p backups logs uploads && \
    chown -R appuser:appgroup backups logs uploads && \
    chmod 750 backups logs uploads

USER appuser

EXPOSE 5000

# dumb-init: PID 1 signal forwarding + zombie reaping (SIGTERM → gracefulShutdown)
ENTRYPOINT ["dumb-init", "--"]

# Health probe hits the enhanced /api/health endpoint (returns 503 if DB is down)
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health | grep -q '"status":"ok"' || exit 1

CMD ["node", "server.js"]
