#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  AByte POS — Admin Panel Deploy Script
#  Usage: cd /var/www/AByte-POS && bash admin-panel/deploy.sh
# ═══════════════════════════════════════════════════════════════

set -e

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m';  GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m';     DIM='\033[2m'; NC='\033[0m'

# ── Paths ─────────────────────────────────────────────────────
ROOT_DIR="/var/www/AByte-POS"
PROJECT_DIR="$ROOT_DIR/admin-panel"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
PM2_APP="abyte-admin-api"

# ── Helpers ───────────────────────────────────────────────────
START_TIME=$(date +%s)

step() { echo -e "\n${CYAN}${BOLD}[$1/5]${NC} ${BOLD}$2${NC}"; }
ok()   { echo -e "      ${GREEN}✓${NC} $1"; }
info() { echo -e "      ${DIM}→ $1${NC}"; }
fail() { echo -e "\n${RED}${BOLD}✗ FAILED: $1${NC}\n"; exit 1; }

elapsed() {
  local END=$(date +%s)
  echo $(( END - START_TIME ))
}

# ══════════════════════════════════════════════════════════════
echo -e "\n${YELLOW}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}${BOLD}║      AByte POS — Admin Panel Deploy      ║${NC}"
echo -e "${YELLOW}${BOLD}║      $(date '+%Y-%m-%d  %H:%M:%S')                 ║${NC}"
echo -e "${YELLOW}${BOLD}╚══════════════════════════════════════════╝${NC}"

# ── Step 1: Git Pull ──────────────────────────────────────────
step 1 "Pulling latest code from Git..."
cd "$ROOT_DIR"

BEFORE=$(git rev-parse HEAD)
git pull origin main
AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  ok "Already up to date ($(git rev-parse --short HEAD))"
else
  ok "Updated to $(git rev-parse --short HEAD)"
  info "Changed files:"
  git diff --name-only "$BEFORE" "$AFTER" | grep "admin-panel/" | sed 's/^/        /' || true
fi

# ── Step 2: Backend Dependencies ─────────────────────────────
step 2 "Installing backend dependencies..."
cd "$BACKEND_DIR"

npm install --omit=dev --silent 2>&1 | tail -1 || fail "npm install failed"
ok "Backend packages ready"

# ── Step 3: Build Frontend ────────────────────────────────────
step 3 "Building frontend (React + Vite)..."
cd "$FRONTEND_DIR"

npm install --silent 2>&1 | tail -1 || fail "Frontend npm install failed"

BUILD_START=$(date +%s)
npm run build 2>&1 | tail -3
BUILD_END=$(date +%s)
BUILD_TIME=$(( BUILD_END - BUILD_START ))

ok "Frontend built in ${BUILD_TIME}s"
info "Output: $FRONTEND_DIR/dist"

DIST_SIZE=$(du -sh "$FRONTEND_DIR/dist" 2>/dev/null | cut -f1 || echo "?")
info "Bundle size: $DIST_SIZE"

# ── Step 4: Restart PM2 ───────────────────────────────────────
step 4 "Restarting backend via PM2..."
cd "$PROJECT_DIR"

pm2 startOrRestart ecosystem.config.js --env production --silent
pm2 save --force --silent

sleep 2

ok "PM2 process restarted"

# ── Step 5: Health Check ──────────────────────────────────────
step 5 "Running health check..."

sleep 2
STATUS=$(pm2 jlist 2>/dev/null | node -e "
  const list = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const app = list.find(p => p.name === '$PM2_APP');
  if (app) {
    console.log(app.pm2_env.status + '|' + app.pid + '|' + Math.round(app.monit?.memory/1024/1024) + 'MB');
  } else {
    console.log('not_found');
  }
" 2>/dev/null || echo "unknown")

if echo "$STATUS" | grep -q "online"; then
  PM2_PID=$(echo $STATUS | cut -d'|' -f2)
  PM2_MEM=$(echo $STATUS | cut -d'|' -f3)
  ok "Process online — PID: $PM2_PID | Memory: $PM2_MEM"
else
  echo -e "      ${YELLOW}⚠ Could not verify process status${NC}"
fi

# ── Done ──────────────────────────────────────────────────────
TOTAL=$(elapsed)

echo -e "\n${GREEN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║         ✅  Deploy Successful!            ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo -e ""
echo -e "  ${DIM}Total time  :${NC} ${BOLD}${TOTAL}s${NC}"
echo -e "  ${DIM}Commit      :${NC} $(git rev-parse --short HEAD)"
echo -e "  ${DIM}Backend     :${NC} pm2 logs $PM2_APP"
echo -e "  ${DIM}Frontend    :${NC} nginx → $FRONTEND_DIR/dist"
echo -e ""
