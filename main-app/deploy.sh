#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Abyte ERP — Main App Deploy Script
# ═══════════════════════════════════════════════════════════════

set -e

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
echo -e "${CYAN}${BOLD}║      Abyte ERP — Main App Deploy         ║${NC}"
echo -e "${CYAN}${BOLD}║      $(date '+%Y-%m-%d  %H:%M:%S')                 ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo -e "  Node: $(node -v)  |  npm: $(npm -v)  |  pwd: $(pwd)"

# ── Step 1: Git Update ────────────────────────────────────────
step 1 "Pulling latest code from Git..."
cd "$ROOT_DIR"

# Clear any stale git lock files from aborted operations
rm -f .git/index.lock .git/HEAD.lock 2>/dev/null || true

# Discard ALL local tracked changes before fetching
git checkout -- . 2>/dev/null || true

BEFORE=$(git rev-parse HEAD)
echo "  Current: $(git rev-parse --short HEAD)"

git fetch origin main 2>&1 || fail "git fetch failed — check network/credentials"
git reset --hard origin/main || fail "git reset failed"

AFTER=$(git rev-parse HEAD)
echo "  After:   $(git rev-parse --short HEAD)"

if [ "$BEFORE" = "$AFTER" ]; then
  ok "Already up to date"
else
  ok "Updated: $BEFORE → $(git rev-parse --short HEAD)"
  git diff --name-only "$BEFORE" "$AFTER" | grep "^main-app/" | head -20 | sed 's/^/        /' || true
fi

# ── Step 2: Backend Dependencies ─────────────────────────────
step 2 "Installing backend dependencies..."
cd "$BACKEND_DIR"

npm install --omit=dev 2>&1 || fail "Backend npm install failed"
ok "Backend packages ready"

# ── Step 3: DB Migrations ────────────────────────────────────
step 3 "Running database migrations..."
cd "$BACKEND_DIR"

if node scripts/migrate-all.js 2>&1; then
  ok "All tenant DBs migrated"
else
  echo -e "      ${YELLOW}⚠ Migration warnings — check logs${NC}"
fi

# ── Step 4: Build Frontend ────────────────────────────────────
step 4 "Building frontend (React + Vite)..."
cd "$FRONTEND_DIR"

npm install 2>&1 || fail "Frontend npm install failed"
npm run build 2>&1 || fail "Frontend build failed"

ok "Frontend built"
info "Bundle: $(du -sh dist 2>/dev/null | cut -f1 || echo '?')"

# ── Step 5: Restart PM2 ───────────────────────────────────────
step 5 "Restarting backend via PM2..."
cd "$PROJECT_DIR"

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
  ok "Process online — PID: $(echo $STATUS | cut -d'|' -f2)"
else
  echo -e "      ${YELLOW}⚠ Status: $STATUS — run: pm2 logs $PM2_APP${NC}"
fi

# ── Done ──────────────────────────────────────────────────────
echo -e "\n${GREEN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║         ✅  Deploy Successful!  $(elapsed)s     ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo -e "  Commit: $(git rev-parse --short HEAD)"
echo -e "  Logs:   pm2 logs $PM2_APP"
echo ""
