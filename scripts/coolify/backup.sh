#!/usr/bin/env bash
# /usr/local/bin/fastio-backup.sh [mode]
#
# Modes:
#   db        — daily pg_dump → S3 (default)
#   storage   — weekly snapshot of fastio-storage bucket → fastio-backups/storage-YYYY-MM-DD/
#
# Required env file: /etc/fastio-backup.env (chmod 600 root:root)
#   TELEGRAM_BOT_TOKEN=...
#   TELEGRAM_CHAT_ID=...
#   TELEGRAM_PROXY=socks5h://127.0.0.1:1080   # опционально, для обхода RKN-блока
#
# Cron на VPS:
#   0 3 * * *   /usr/local/bin/fastio-backup.sh db
#   30 4 * * 0  /usr/local/bin/fastio-backup.sh storage
#
# Restore — см. /usr/local/bin/fastio-restore-test.sh (или вручную):
#   rclone copy twS3:fastio-backups/postgres-YYYYMMDD-HHMMSS.sql.gz /tmp/
#   gunzip < /tmp/postgres-*.sql.gz | docker exec -i $(docker ps --format '{{.Names}}' | grep '^supabase-db-' | head -1) psql -U postgres -d postgres

set -euo pipefail

# === Config ===
ENV_FILE="/etc/fastio-backup.env"
LOG_DIR="/var/log/fastio-backup"
BACKUP_DIR="/var/backups/fastio"
S3_REMOTE="twS3:fastio-backups"
STORAGE_REMOTE="twS3:fastio-storage"

DB_RETAIN_LOCAL_DAYS=7
DB_RETAIN_S3_DAYS=30
STORAGE_RETAIN_SNAPSHOTS=4   # keep last N weekly snapshots
LOG_RETAIN_DAYS=30

MODE="${1:-db}"

# === Setup ===
mkdir -p "$LOG_DIR" "$BACKUP_DIR"
LOG_FILE="${LOG_DIR}/${MODE}-$(date -u +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

log()  { echo "[$(date -uIs)] $*"; }
fail() { log "ERROR: $*"; exit 1; }

# Load env for Telegram creds (non-fatal — alerts simply won't fire)
if [ -f "$ENV_FILE" ]; then
  set -a; . "$ENV_FILE"; set +a
else
  log "WARN: $ENV_FILE not found — alerts disabled"
fi

# === Telegram failure alert ===
notify_failure() {
  local rc=$?
  [ "$rc" -eq 0 ] && return 0
  [ -z "${TELEGRAM_BOT_TOKEN:-}" ] && return 0
  [ -z "${TELEGRAM_CHAT_ID:-}" ] && return 0

  local tail_log
  tail_log=$(tail -20 "$LOG_FILE" \
    | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' \
    | head -c 3000)

  local text
  text=$(printf '❌ <b>FastIO backup FAILED</b>\nMode: <code>%s</code>\nHost: %s\nExit: %d\nLog: <code>%s</code>\n\n<pre>%s</pre>' \
    "$MODE" "$(hostname)" "$rc" "$LOG_FILE" "$tail_log")

  curl -sS --max-time 15 \
    ${TELEGRAM_PROXY:+--proxy "$TELEGRAM_PROXY"} \
    -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "parse_mode=HTML" \
    --data-urlencode "text=${text}" >/dev/null || true
}
trap notify_failure EXIT

# === Concurrency guard ===
exec 9>"/var/lock/fastio-backup-${MODE}.lock"
flock -n 9 || fail "another '${MODE}' backup already running"

# === Sanity ===
command -v docker >/dev/null || fail "docker not installed"
command -v rclone >/dev/null || fail "rclone not installed (apt-get install -y rclone)"
rclone listremotes | grep -q "^twS3:$" \
  || fail "rclone remote 'twS3' not configured (rclone config)"

# === Modes ===
case "$MODE" in

  db)
    DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep '^supabase-db-' | head -1 || true)
    [ -n "$DB_CONTAINER" ] || fail "supabase-db container not found (Coolify UUID changed?)"

    DATE=$(date -u +%Y%m%d-%H%M%S)
    FILENAME="postgres-${DATE}.sql.gz"
    LOCAL_PATH="${BACKUP_DIR}/${FILENAME}"

    log "Dumping Postgres from ${DB_CONTAINER} → ${LOCAL_PATH}"
    docker exec "$DB_CONTAINER" pg_dump -U postgres -d postgres \
        --clean --if-exists --quote-all-identifiers \
      | gzip -9 > "$LOCAL_PATH"

    [ -s "$LOCAL_PATH" ] || fail "dump is empty"
    LOCAL_BYTES=$(stat -c%s "$LOCAL_PATH")
    log "Dump complete: $(du -h "$LOCAL_PATH" | cut -f1) (${LOCAL_BYTES} bytes)"

    log "Uploading to ${S3_REMOTE}/"
    rclone copy "$LOCAL_PATH" "${S3_REMOTE}/" \
      --s3-no-check-bucket --retries 3 --low-level-retries 5

    log "Verifying upload (size match)"
    S3_BYTES=$(rclone ls "${S3_REMOTE}/" --include "$FILENAME" | awk '{print $1}' | head -1)
    [ "$S3_BYTES" = "$LOCAL_BYTES" ] \
      || fail "S3 size mismatch: local=${LOCAL_BYTES}, s3=${S3_BYTES:-MISSING}"
    log "Verify OK (${S3_BYTES} bytes on S3)"

    log "Pruning local backups older than ${DB_RETAIN_LOCAL_DAYS}d"
    find "$BACKUP_DIR" -name "postgres-*.sql.gz" -mtime "+${DB_RETAIN_LOCAL_DAYS}" -delete

    log "Pruning S3 backups older than ${DB_RETAIN_S3_DAYS}d"
    rclone delete "${S3_REMOTE}/" \
      --include "postgres-*.sql.gz" \
      --min-age "${DB_RETAIN_S3_DAYS}d"

    log "Backup OK: ${FILENAME}"
    ;;

  storage)
    SNAPSHOT="storage-$(date -u +%Y-%m-%d)"
    DEST="${S3_REMOTE}/${SNAPSHOT}/"

    log "Snapshotting ${STORAGE_REMOTE}/ → ${DEST}"
    rclone copy "${STORAGE_REMOTE}/" "$DEST" \
      --s3-no-check-bucket --retries 3 --low-level-retries 5 \
      --transfers 8 --checkers 16

    log "Verifying snapshot (size match)"
    # rclone size output: "Total size: 495.193 KiB (507078 Byte)" — берём число внутри скобок
    SRC_BYTES=$(rclone size "${STORAGE_REMOTE}/" | sed -n 's/.*(\([0-9]\+\) Byte.*/\1/p')
    DST_BYTES=$(rclone size "${DEST}"            | sed -n 's/.*(\([0-9]\+\) Byte.*/\1/p')
    [ -n "$SRC_BYTES" ] && [ -n "$DST_BYTES" ] && [ "$SRC_BYTES" = "$DST_BYTES" ] \
      || fail "storage size mismatch: src=${SRC_BYTES:-?}, dst=${DST_BYTES:-?}"
    log "Verify OK (${DST_BYTES} bytes)"

    log "Pruning storage snapshots (keep last ${STORAGE_RETAIN_SNAPSHOTS})"
    # rclone lsd: "<perms> <size> <date> <time> <name>" — берём имя, фильтруем, сортируем
    # хронологически (имена с YYYY-MM-DD sortable как строки), оставляем последние N.
    rclone lsd "${S3_REMOTE}/" \
      | awk '{print $NF}' \
      | grep '^storage-[0-9]' \
      | sort \
      | head -n -"${STORAGE_RETAIN_SNAPSHOTS}" \
      | while read -r old_dir; do
          log "Removing old snapshot: ${old_dir}"
          rclone purge "${S3_REMOTE}/${old_dir}/"
        done

    log "Storage backup OK: ${SNAPSHOT} (${DST_BYTES} bytes)"
    ;;

  *)
    fail "Unknown mode: ${MODE} (use: db | storage)"
    ;;
esac

# === Log rotation ===
find "$LOG_DIR" -name "*.log" -mtime "+${LOG_RETAIN_DAYS}" -delete 2>/dev/null || true

trap - EXIT
log "Done."
