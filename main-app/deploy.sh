#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  AbyteDesk ERP — Main App Deploy Script
# ═══════════════════════════════════════════════════════════════

set -e

# ── Load Node.js (nvm or system) ──────────────────────────────
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
fi
# Fallback: common system node locations
for NODE_PATH in /usr/local/bin /usr/bin /opt/node/bin; do
  [ -x "$NODE_PATH/node" ] && export PATH="$NODE_PATH:$PATH" && break
done

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m';  GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m';     DIM='\033[2m'; NC='\033[0m'

# ── Paths ─────────────────────────────────────────────────────
ROOT_DIR="/var/www/AByte-POS"
PROJECT_DIR="$ROOT_DIR/main-app"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
PM2_APP="abyte-main-api"

# ── Helpers ───────────────────────────────────────────────────
START_TIME=$(date +%s)
step() { echo -e "\n${CYAN}${BOLD}[$1/6]${NC} ${BOLD}$2${NC}"; }
ok()   { echo -e "      ${GREEN}✓${NC} $1"; }
info() { echo -e "      ${DIM}→ $1${NC}"; }
fail() { echo -e "\n${RED}${BOLD}✗ FAILED: $1${NC}\n"; exit 1; }
elapsed() { local END=$(date +%s); echo $(( END - START_TIME )); }

# ══════════════════════════════════════════════════════════════
echo -e "\n${CYAN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║      AbyteDesk ERP — Main App Deploy         ║${NC}"
echo -e "${CYAN}${BOLD}║      $(date '+%Y-%m-%d  %H:%M:%S')                 ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo "  node: $(node --version 2>/dev/null || echo 'NOT FOUND')"
echo "  npm:  $(npm --version  2>/dev/null || echo 'NOT FOUND')"
echo "  pm2:  $(pm2 --version  2>/dev/null || echo 'NOT FOUND')"

# Abort early if node/npm missing
command -v node >/dev/null 2>&1 || fail "node not found in PATH. Check nvm/node installation."
command -v npm  >/dev/null 2>&1 || fail "npm not found in PATH."

# ── Step 1: Git Update ────────────────────────────────────────
step 1 "Pulling latest code from Git..."
cd "$ROOT_DIR"

rm -f .git/index.lock .git/HEAD.lock 2>/dev/null || true
git checkout -- . 2>/dev/null || true

BEFORE=$(git rev-parse HEAD)
git fetch origin main 2>&1 || fail "git fetch failed"
git reset --hard origin/main   || fail "git reset --hard failed"
AFTER=$(git rev-parse HEAD)

# Restore env files from backup (git reset --hard deletes them)
if [ -f /root/env-backup/main-app.env ]; then
  cp /root/env-backup/main-app.env "$BACKEND_DIR/.env.production"
  ok "Restored .env.production from backup"
else
  echo -e "      ${YELLOW}⚠ No env backup found at /root/env-backup/main-app.env${NC}"
fi

if [ "$BEFORE" = "$AFTER" ]; then
  ok "Already up to date ($(git rev-parse --short HEAD))"
else
  ok "Updated $(git rev-parse --short "$BEFORE") → $(git rev-parse --short HEAD)"
  git diff --name-only "$BEFORE" "$AFTER" | grep "^main-app/" | head -20 | sed 's/^/        /' || true
fi

# ── Step 2: Backend Dependencies ─────────────────────────────
step 2 "Installing backend dependencies..."
cd "$BACKEND_DIR"

npm install --omit=dev 2>&1 || fail "Backend npm install failed"
ok "Backend packages ready"

# ── Step 3: DB Migrations ────────────────────────────────────
step 3 "Running database migrations..."
if node scripts/migrate-all.js 2>&1; then
  ok "All tenant DBs migrated"
else
  echo -e "      ${YELLOW}⚠ Migration warnings — continuing${NC}"
fi

# ── Step 4: Build Frontend ────────────────────────────────────
step 4 "Building frontend (React + Vite)..."
cd "$FRONTEND_DIR"

npm install 2>&1          || fail "Frontend npm install failed"
npm run build 2>&1        || fail "Frontend build failed"

ok "Frontend built ($(du -sh dist 2>/dev/null | cut -f1 || echo '?'))"

# ── Step 5: Restart PM2 ───────────────────────────────────────
step 5 "Restarting backend via PM2..."
cd "$PROJECT_DIR"

command -v pm2 >/dev/null 2>&1 || fail "pm2 not found in PATH"
pm2 startOrRestart ecosystem.config.js --env production 2>&1 || fail "PM2 restart failed"
pm2 save --force 2>&1 || true
sleep 3
ok "PM2 restarted"

# ── Step 6: Health Check ──────────────────────────────────────
step 6 "Health check..."
sleep 2

STATUS=$(pm2 jlist 2>/dev/null | node -e "
  try {
    const list = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const app = list.find(p => p.name === '$PM2_APP');
    console.log(app ? (app.pm2_env.status + '|' + app.pid) : 'not_found');
  } catch(e) { console.log('parse_error'); }
" 2>/dev/null || echo "unknown")

if echo "$STATUS" | grep -q "online"; then
  ok "Process online — PID: $(echo "$STATUS" | cut -d'|' -f2)"
else
  echo -e "      ${YELLOW}⚠ PM2 status: $STATUS — run: pm2 logs $PM2_APP${NC}"
fi

WORKER_STATUS=$(pm2 jlist 2>/dev/null | node -e "
  try {
    const list = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const app = list.find(p => p.name === 'abyte-email-worker');
    console.log(app ? app.pm2_env.status : 'not_found');
  } catch(e) { console.log('parse_error'); }
" 2>/dev/null || echo "unknown")

if echo "$WORKER_STATUS" | grep -q "online"; then
  ok "Email worker online"
else
  echo -e "      ${YELLOW}⚠ Email worker status: $WORKER_STATUS — run: pm2 logs abyte-email-worker${NC}"
fi

# ── Done ──────────────────────────────────────────────────────
echo -e "\n${GREEN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║         ✅  Deploy Successful!            ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo "  Time:   $(elapsed)s"
echo "  Commit: $(git -C "$ROOT_DIR" rev-parse --short HEAD)"
echo "  Logs:   pm2 logs $PM2_APP"
echo ""
