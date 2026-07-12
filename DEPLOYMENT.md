# AByte ERP — Enterprise Deployment Guide

## Architecture Overview

```
Internet
   │
   ▼
[Nginx]  ← HTTPS/HTTP2, rate-limiting, static files, gzip
   │
   ├──► /api/*  ──► [Node.js API]  ×2 instances (PM2 cluster / Docker replicas)
   │                     │
   │                     ├──► [MariaDB]  (per-tenant DBs, SSL)
   │                     ├──► [Redis]    (cache + BullMQ queues)
   │                     └──► [S3/R2]   (optional, logo/backup storage)
   │
   └──► /*      ──► /dist (SPA static files)

Background:
  [Email Worker]  ─── BullMQ ──► Redis ──► emailService (nodemailer)
  [Backup Cron]   ──► MariaDB dump ──► local/Google Drive/S3
```

---

## 1. Server Requirements

| Resource | Minimum (100 users) | Recommended (1000 users) |
|----------|--------------------|-----------------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB | 4 GB |
| Disk | 40 GB SSD | 100 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

---

## 2. Environment Variables

Copy `.env.example` to `main-app/backend/.env.production` and fill in:

```env
# ── Database ───────────────────────────
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=abyte_user
DB_PASSWORD=<strong-random-password>
DB_NAME=abyte_pos
MASTER_DB_NAME=abyte_master
DB_SSL_CA=/etc/ssl/certs/ca-certificates.crt   # for remote DB with SSL

# ── Auth ───────────────────────────────
JWT_SECRET=<64-byte-hex: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_EXPIRES_IN=8h

# ── Server ─────────────────────────────
NODE_ENV=production
PORT=5000
ALLOWED_ORIGINS=https://your-domain.com

# ── Redis ──────────────────────────────
REDIS_URL=redis://127.0.0.1:6379

# ── Email ──────────────────────────────
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_USER=postmaster@mg.your-domain.com
EMAIL_PASS=<mailgun-smtp-password>
EMAIL_FROM="AByte ERP <noreply@your-domain.com>"

# ── Object Storage (optional) ──────────
STORAGE_PROVIDER=local           # s3 | r2 | minio | local
STORAGE_BUCKET=abyte-uploads
# For S3:
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
# For R2:
CLOUDFLARE_ACCOUNT_ID=...
# For MinIO:
MINIO_ENDPOINT=http://minio:9000

# ── Monitoring ─────────────────────────
METRICS_TOKEN=<random-token-for-prometheus-scrape>
LOG_LEVEL=info

# ── AI (optional) ──────────────────────
GROQ_API_KEY=gsk_...

# ── Backup ─────────────────────────────
MARIADB_DUMP_PATH=/usr/bin/mariadb-dump

# ── Grafana (Docker only) ──────────────
GRAFANA_PASSWORD=<strong-password>
```

---

## 3. Docker Deployment

### First-time setup

```bash
git clone https://github.com/your-org/AByte-POS.git /opt/abyte
cd /opt/abyte
cp .env.example .env
# Edit .env with your values
nano .env

# Build and start
docker compose up -d --build

# Verify
docker compose ps
docker compose logs backend --tail 50
```

### With monitoring stack

```bash
docker compose --profile monitoring up -d
# Grafana available at http://your-server:3001
```

### Zero-downtime update

```bash
git pull
docker compose build backend
docker compose up -d --no-deps --scale backend=2 backend
# Old containers drain, new ones take traffic
```

---

## 4. PM2 Deployment (bare-metal / VPS)

### Install dependencies

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs mariadb-client redis-server nginx certbot python3-certbot-nginx

# PM2 globally
sudo npm install -g pm2

# App dependencies
cd /var/www/AByte-POS/main-app/backend
npm ci --omit=dev
```

### Start with PM2

```bash
cd /var/www/AByte-POS/main-app
pm2 start ecosystem.config.js --env production

# Save PM2 process list (survives reboot)
pm2 save
pm2 startup   # follow printed command to enable systemd service
```

### Zero-downtime reload

```bash
pm2 reload ecosystem.config.js --env production
```

### Email worker

The ecosystem.config.js starts `abyte-email-worker` automatically.
Requires `REDIS_URL` to be set. If Redis is absent the worker exits and email
falls back to inline sending in the main API process.

---

## 5. Nginx SSL Setup

```bash
# Replace all instances of YOUR_DOMAIN
sudo nano /etc/nginx/sites-available/abyte-main
# Paste contents of main-app/nginx.conf with domain substituted

# Install certificate
sudo certbot --nginx -d your-domain.com

# Copy rate-limit zones (add to nginx.conf http block)
sudo cp infra/nginx/rate_limit_zones.conf /etc/nginx/
# Edit /etc/nginx/nginx.conf and add inside http { }:
#   include /etc/nginx/rate_limit_zones.conf;

# Copy shared proxy params
sudo cp infra/nginx/proxy_params /etc/nginx/proxy_params

# Enable and test
sudo ln -sf /etc/nginx/sites-available/abyte-main /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Auto-renew SSL
sudo systemctl enable certbot.timer
```

---

## 6. Redis Configuration

```bash
# Production-hardened Redis (/etc/redis/redis.conf)
sudo nano /etc/redis/redis.conf

# Key settings:
maxmemory 256mb
maxmemory-policy allkeys-lru
appendonly yes
requirepass <your-redis-password>   # then add :password@ to REDIS_URL
```

---

## 7. Prometheus + Grafana Monitoring

```bash
# Via Docker (recommended)
docker compose --profile monitoring up -d

# Access Grafana
open http://your-server:3001
# Login: admin / $GRAFANA_PASSWORD

# Import dashboard: Grafana.com dashboard ID 11159 (Node.js)
# AByte custom metrics prefix: abyte_
```

Key metrics exposed at `/api/metrics`:

| Metric | Description |
|--------|-------------|
| `abyte_http_requests_total` | Request count by route/status |
| `abyte_http_request_duration_seconds` | Latency histogram |
| `abyte_db_pool_active_count` | Live MariaDB tenant pools |
| `abyte_queue_jobs_total` | Email/report jobs by status |
| `abyte_nodejs_heap_used_bytes` | Heap memory |
| `abyte_nodejs_event_loop_lag_seconds` | Event-loop lag |

---

## 8. Backup Schedule & Retention

Backups run via cron daily at 02:00 (configurable in Settings → Backup).

**Retention policy (enforced automatically at 03:00 daily):**

| Age | Retention |
|-----|-----------|
| 0 – 7 days | Every backup kept |
| 7 – 28 days | 1 per week |
| 28 – 90 days | 1 per month |
| > 90 days | Deleted |

**Manual backup restore:**

```bash
# List available backups
ls /var/www/AByte-POS/main-app/backend/backups/

# Restore (WARNING: overwrites the database)
mariadb -h 127.0.0.1 -u abyte_user -p < backups/abyte_all_backup_YYYYMMDD_HHMMSS.sql
```

**Backup verification** runs automatically at 03:00 and logs:
```
[Backup] Last backup integrity OK { filename: "...", sizeBytes: 1234567 }
```

---

## 9. Health & Readiness Probes

| Endpoint | Auth | Returns | Use |
|----------|------|---------|-----|
| `GET /api/ping` | None | `{"ok":true}` | Nginx upstream check |
| `GET /api/ready` | None | `{"ready":true}` | Load balancer readiness |
| `GET /api/health` | None | JSON with DB latency, memory, pools | Deep health check |
| `GET /api/metrics` | Bearer `$METRICS_TOKEN` | Prometheus text | Prometheus scrape |

---

## 10. Disaster Recovery Checklist

- [ ] Verify last backup integrity: `GET /api/backup/verify` (Admin only)
- [ ] Test restore on staging before applying to production
- [ ] Confirm MariaDB replication is in-sync (if using replica)
- [ ] Check Redis is flushed/ready on new host before starting app
- [ ] Update `.env.production` with new DB_HOST / REDIS_URL
- [ ] Run `pm2 restart ecosystem.config.js --env production`
- [ ] Confirm `/api/health` returns `{"status":"ok"}` on new host
- [ ] Smoke-test login, a POS sale, and a report
- [ ] Update DNS A record to new server IP
- [ ] Re-issue SSL certificate on new server: `certbot --nginx -d your-domain.com`

**Target RTO: 30 minutes** (restore from last daily backup + DNS propagation)
**Target RPO: 24 hours** (last scheduled backup)
With Google Drive integration enabled: **RPO reduces to ≤ 1 hour**.

---

## 11. Scaling Beyond Single Server

| Tier | Users | Config |
|------|-------|--------|
| S1 | ≤ 500 | Single VPS, PM2 2 workers, Redis local |
| S2 | ≤ 2,000 | 2 VPS + Nginx load balancer, Redis Sentinel |
| S3 | ≤ 10,000 | 4 API nodes + dedicated DB server + Redis Cluster |
| S4 | ≤ 50,000 | Kubernetes (3 nodes), PlanetScale/RDS, Elasticache |

See **Capacity Assessment** section in the Final Report for detailed requirements.
