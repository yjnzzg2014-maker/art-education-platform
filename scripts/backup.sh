#!/bin/bash
# Database backup script for Art Education Platform
# Usage: ./scripts/backup.sh [backup_dir]

BACKUP_DIR="${1:-./backups}"
DB_FILE="./server/artedu.db"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/artedu_$TIMESTAMP.db"

echo "Backing up $DB_FILE to $BACKUP_FILE..."
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"

if [ $? -eq 0 ]; then
  echo "Backup complete: $BACKUP_FILE"
  # Keep only last 7 daily backups
  ls -t "$BACKUP_DIR"/artedu_*.db 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null
else
  echo "Backup failed!" >&2
  exit 1
fi
