# ── Stage 1: build ───────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# ── Stage 2: minimal Nginx image ─────────────────────────────
FROM nginx:1.27-alpine AS production

# Remove default Nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled SPA
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Non-root: Nginx runs as the built-in 'nginx' user (UID 101) in alpine image.
# The conf below must use /tmp for pid and temp files.
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx && \
    touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/api/ping || exit 1

CMD ["nginx", "-g", "daemon off;"]
