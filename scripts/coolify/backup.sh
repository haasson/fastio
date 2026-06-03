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
SCRIPT_START=$(date +%s)

# === Setup ===
mkdir -p "$LOG_DIR" "$BACKUP_DIR"
LOG_FILE="${LOG_DIR}/${MODE}-$(date -u +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

log()  { echo "[$(date -uIs)] $*"; }
fail() { log "ERROR: $*"; exit 1; }

# Helpers для красивых нотификаций
fmt_duration() {
  local sec=$(( $(date +%s) - SCRIPT_START ))
  if [ "$sec" -lt 60 ];   then echo "${sec} сек"
  elif [ "$sec" -lt 3600 ]; then echo "$((sec/60)) мин $((sec%60)) сек"
  else                          echo "$((sec/3600)) ч $(((sec%3600)/60)) мин"
  fi
}

local_now() { TZ=Asia/Barnaul date '+%H:%M %d.%m.%Y'; }

# rclone size → "495.193 KiB" + count; принимают любые доп. флаги (--include и т.д.)
s3_size_human() {
  rclone size "$@" 2>/dev/null | awk '/Total size/ {print $3, $4}'
}
s3_count() {
  rclone size "$@" 2>/dev/null | awk '/Total objects/ {print $3}'
}

# Load env for Telegram creds (non-fatal — alerts simply won't fire)
if [ -f "$ENV_FILE" ]; then
  set -a; . "$ENV_FILE"; set +a
else
  log "WARN: $ENV_FILE not found — alerts disabled"
fi

# === Telegram alerts (success + failure) ===
# Тишина ≠ всё хорошо. Слать сообщение и при успехе тоже — если кружка алёртов
# (прокси, sing-box, сервер друга) упала, отсутствие ожидаемого daily ✓ сразу
# подскажет «что-то не так».
tg_send() {
  [ -z "${TELEGRAM_BOT_TOKEN:-}" ] && return 0
  [ -z "${TELEGRAM_CHAT_ID:-}" ] && return 0
  curl -sS --max-time 15 \
    ${TELEGRAM_PROXY:+--proxy "$TELEGRAM_PROXY"} \
    -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "parse_mode=HTML" \
    --data-urlencode "text=$1" >/dev/null || true
}

notify_success() { tg_send "$1"; }

notify_failure() {
  local rc=$?
  [ "$rc" -eq 0 ] && return 0

  local tail_log err_line mode_name
  tail_log=$(tail -20 "$LOG_FILE" \
    | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' \
    | head -c 3000)
  err_line=$(grep "ERROR:" "$LOG_FILE" | tail -1 | sed -E 's/^\[[^]]+\] ERROR: //' \
    | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' \
    | head -c 500)
  case "$MODE" in
    db)      mode_name="ежедневный бэкап БД" ;;
    storage) mode_name="недельный снапшот storage" ;;
    *)       mode_name="$MODE" ;;
  esac

  tg_send "$(printf '🚨 <b>Бэкап упал</b> — %s\nОшибка: <code>%s</code>\nКод выхода: %d\nДлительность: %s\nЛог: <code>%s</code>\n\n<pre>%s</pre>' \
    "$mode_name" "${err_line:-неизвестно}" "$rc" "$(fmt_duration)" "$LOG_FILE" "$tail_log")"
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
    # --max-depth 1: дампы лежат плоско в корне бакета, а рядом — wal-g WAL-архив
    # (новый объект каждые 60с, десятки тысяч). Без max-depth rclone обходит весь
    # бакет рекурсивно ради --include → prune рос 6→18 мин. С флагом — ~секунда.
    rclone delete "${S3_REMOTE}/" \
      --include "postgres-*.sql.gz" \
      --min-age "${DB_RETAIN_S3_DAYS}d" \
      --max-depth 1

    log "Backup OK: ${FILENAME}"
    notify_success "$(printf '✅ <b>Ежедневный бэкап БД</b>\nФайл: <code>%s</code>\nРазмер: %s\nДлительность: %s\nВсего на S3: %s файлов, %s\nВремя: %s Барнаул\nСледующий: завтра в 10:00' \
      "$FILENAME" \
      "$(du -h "$LOCAL_PATH" | cut -f1)" \
      "$(fmt_duration)" \
      "$(s3_count "${S3_REMOTE}/" --include 'postgres-*.sql.gz' --max-depth 1)" \
      "$(s3_size_human "${S3_REMOTE}/" --include 'postgres-*.sql.gz' --max-depth 1)" \
      "$(local_now)")"
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
    SNAPSHOT_COUNT=$(rclone lsd "${S3_REMOTE}/" 2>/dev/null | awk '$NF ~ /^storage-/' | wc -l)
    SNAPSHOT_FILES=$(s3_count "${S3_REMOTE}/${SNAPSHOT}/")
    SNAPSHOT_HUMAN=$(s3_size_human "${S3_REMOTE}/${SNAPSHOT}/")
    notify_success "$(printf '✅ <b>Недельный снапшот storage</b>\nСнапшот: <code>%s</code>\nРазмер: %s (%s файлов)\nДлительность: %s\nСнапшотов хранится: %s из %s\nВремя: %s Барнаул\nСледующий: воскресенье в 11:30' \
      "$SNAPSHOT" \
      "$SNAPSHOT_HUMAN" \
      "$SNAPSHOT_FILES" \
      "$(fmt_duration)" \
      "$SNAPSHOT_COUNT" \
      "$STORAGE_RETAIN_SNAPSHOTS" \
      "$(local_now)")"
    ;;

  *)
    fail "Unknown mode: ${MODE} (use: db | storage)"
    ;;
esac

# === Log rotation ===
find "$LOG_DIR" -name "*.log" -mtime "+${LOG_RETAIN_DAYS}" -delete 2>/dev/null || true

trap - EXIT
log "Done."
