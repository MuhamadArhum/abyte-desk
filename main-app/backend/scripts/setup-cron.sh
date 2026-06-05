#!/bin/bash
# =============================================================
# setup-cron.sh — Setup automatic daily backup via cron
#
# Run ONCE on server:
#   chmod +x scripts/setup-cron.sh
#   bash scripts/setup-cron.sh
# =============================================================

SCRIPT_DIR="/var/www/AByte-POS/main-app/backend"
LOG_FILE="/var/log/abyte-backup.log"

echo ""
echo "Setting up automatic daily backup cron job..."

# Create log file if it doesn't exist
touch $LOG_FILE

# Add cron job: runs every day at 2:00 AM
CRON_JOB="0 2 * * * cd $SCRIPT_DIR && node scripts/backup-all.js >> $LOG_FILE 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "backup-all.js"; then
  echo "✓ Cron job already exists — skipping"
else
  # Add to crontab
  (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
  echo "✓ Cron job added: runs daily at 2:00 AM"
fi

echo ""
echo "Current crontab:"
crontab -l
echo ""
echo "Backup log: $LOG_FILE"
echo "Done!"
echo ""
