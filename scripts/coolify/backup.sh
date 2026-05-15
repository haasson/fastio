#!/usr/bin/env bash
# Daily backup self-hosted Supabase Postgres → Timeweb S3 (fastio-backups bucket).
#
# Установка на VPS:
#   1. scp scripts/coolify/backup.sh root@109.71.242.205:/usr/local/bin/fastio-backup.sh
#   2. ssh root@109.71.242.205 'chmod +x /usr/local/bin/fastio-backup.sh'
#   3. apt-get install -y rclone (если ещё нет)
#   4. rclone config — добавить remote с именем `twS3`, type=s3, provider=Other:
#        endpoint = https://s3.twcstorage.ru
#        access_key_id = <из Timeweb Cloud dashboard>
#        secret_access_key = <из Timeweb Cloud dashboard>
#        acl = private
#   5. crontab -e — добавить строку:
#        0 3 * * * /usr/local/bin/fastio-backup.sh >> /var/log/fastio-backup.log 2>&1
#
# Restore (вручную, не входит в этот скрипт):
#   rclone copy twS3:fastio-backups/postgres-YYYYMMDD-HHMMSS.sql.gz /tmp/
#   gunzip < /tmp/postgres-*.sql.gz | docker exec -i $(docker ps --format '{{.Names}}' | grep '^supabase-db-' | head -1) psql -U postgres -d postgres

set -euo pipefail

BACKUP_DIR="/var/backups/fastio"
S3_REMOTE="twS3:fastio-backups"
RETAIN_LOCAL_DAYS=7

log() { echo "[$(date -uIs)] $*"; }
fail() { log "ERROR: $*"; exit 1; }

mkdir -p "$BACKUP_DIR"

DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep '^supabase-db-' | head -1 || true)
[ -n "$DB_CONTAINER" ] || fail "supabase-db container not found (Coolify UUID changed?)"

command -v rclone >/dev/null || fail "rclone not installed (apt-get install -y rclone)"
rclone listremotes | grep -q "^twS3:$" || fail "rclone remote 'twS3' not configured (rclone config)"

DATE=$(date -u +%Y%m%d-%H%M%S)
FILENAME="postgres-${DATE}.sql.gz"
LOCAL_PATH="${BACKUP_DIR}/${FILENAME}"

log "Dumping Postgres from $DB_CONTAINER → $LOCAL_PATH"
docker exec "$DB_CONTAINER" pg_dump -U postgres -d postgres --clean --if-exists --quote-all-identifiers \
  | gzip -9 > "$LOCAL_PATH"

[ -s "$LOCAL_PATH" ] || fail "dump is empty"

SIZE=$(du -h "$LOCAL_PATH" | cut -f1)
log "Dump complete: $SIZE"

log "Uploading to $S3_REMOTE"
rclone copy "$LOCAL_PATH" "$S3_REMOTE/" --s3-no-check-bucket --retries 3 --low-level-retries 5

log "Cleaning local backups older than ${RETAIN_LOCAL_DAYS}d"
find "$BACKUP_DIR" -name "postgres-*.sql.gz" -mtime "+${RETAIN_LOCAL_DAYS}" -delete

log "Backup OK: ${FILENAME} (${SIZE})"
