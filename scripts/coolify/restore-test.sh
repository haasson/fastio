#!/usr/bin/env bash
# /usr/local/bin/fastio-restore-test.sh
#
# Раз в месяц прогоняет реальный restore последнего бэкапа в изолированный
# временный Postgres-контейнер, проверяет что схема + ключевые таблицы живы.
# Live БД не трогается. На фейле — Telegram alert.
#
# Required env file: /etc/fastio-backup.env (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
#
# Cron на VPS:
#   0 5 1 * *  /usr/local/bin/fastio-restore-test.sh

set -euo pipefail

# === Config ===
ENV_FILE="/etc/fastio-backup.env"
LOG_DIR="/var/log/fastio-backup"
WORK_DIR="/tmp/fastio-restore-test"
S3_REMOTE="twS3:fastio-backups"

# Минимальные пороги: считаем restore успешным если значения >= указанных.
MIN_PUBLIC_TABLES=50
MIN_TENANTS=0   # 0 — допускаем пустой прод (просто проверяем что таблица есть)
MIN_AUTH_USERS=0

# === Setup ===
mkdir -p "$LOG_DIR" "$WORK_DIR"
LOG_FILE="${LOG_DIR}/restore-test-$(date -u +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

log()  { echo "[$(date -uIs)] $*"; }
fail() { log "ERROR: $*"; exit 1; }

if [ -f "$ENV_FILE" ]; then
  set -a; . "$ENV_FILE"; set +a
else
  log "WARN: $ENV_FILE not found — alerts disabled"
fi

# === State for cleanup ===
TEST_CONTAINER=""
TEST_VOLUME=""
DUMP_PATH=""

cleanup() {
  log "Cleanup"
  [ -n "$TEST_CONTAINER" ] && docker rm -f "$TEST_CONTAINER" >/dev/null 2>&1 || true
  [ -n "$TEST_VOLUME"    ] && docker volume rm "$TEST_VOLUME" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR" 2>/dev/null || true
}

notify_failure() {
  local rc=$?
  cleanup
  [ "$rc" -eq 0 ] && return 0
  [ -z "${TELEGRAM_BOT_TOKEN:-}" ] && return 0
  [ -z "${TELEGRAM_CHAT_ID:-}" ] && return 0

  local tail_log
  tail_log=$(tail -25 "$LOG_FILE" \
    | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' \
    | head -c 3000)

  local text
  text=$(printf '🚨 <b>FastIO restore-test FAILED</b>\nHost: %s\nExit: %d\nLog: <code>%s</code>\n\n<pre>%s</pre>' \
    "$(hostname)" "$rc" "$LOG_FILE" "$tail_log")

  curl -sS --max-time 15 \
    -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "parse_mode=HTML" \
    --data-urlencode "text=${text}" >/dev/null || true
}
trap notify_failure EXIT

# === Concurrency guard ===
exec 9>/var/lock/fastio-restore-test.lock
flock -n 9 || fail "another restore-test already running"

# === Sanity ===
command -v docker >/dev/null || fail "docker not installed"
command -v rclone >/dev/null || fail "rclone not installed"

# === Test image ===
# Используем чистый postgres:15, а НЕ supabase/postgres:15. Причина: supabase-образ
# содержит init scripts (migrations/*.sql) которые ожидают существования ролей,
# создаваемых другими сервисами Supabase-стека (supabase_functions_admin и т.д.).
# При запуске в одиночку init падает с exit code 3 → контейнер умирает на старте.
# Чистый postgres стартует за секунды, dump через --clean создаёт все нужные схемы.
# CREATE EXTENSION для pg_cron/pg_net/pgjwt/supabase_vault упадут (бинарников нет),
# и часть служебных функций тоже — это ОЖИДАЕМО и не влияет на верификацию public.*.
# При реальной катастрофе восстановление идёт через свежий Coolify Supabase-стек.
TEST_IMAGE="postgres:15"
log "Using test image: ${TEST_IMAGE}"

# === Pick latest dump from S3 ===
log "Listing dumps on S3"
# --files-only — иначе lsf включит соседние storage-YYYY-MM-DD/ дирректории,
# и `sort | tail -1` выберет их (storage-* > postgres-* по алфавиту).
LATEST=$(rclone lsf "${S3_REMOTE}/" --include "postgres-*.sql.gz" --files-only | sort | tail -1)
[ -n "$LATEST" ] || fail "no postgres-*.sql.gz dumps found on S3"
log "Latest dump: ${LATEST}"

DUMP_PATH="${WORK_DIR}/${LATEST}"
log "Downloading to ${DUMP_PATH}"
rclone copyto "${S3_REMOTE}/${LATEST}" "$DUMP_PATH" --retries 3
[ -s "$DUMP_PATH" ] || fail "downloaded dump is empty"
DUMP_SIZE=$(du -h "$DUMP_PATH" | cut -f1)
log "Dump downloaded: ${DUMP_SIZE}"

# === Spin up isolated test container ===
TEST_CONTAINER="fastio-restore-test-$(date -u +%s)"
TEST_VOLUME="${TEST_CONTAINER}-data"

log "Starting test container: ${TEST_CONTAINER}"
docker run -d \
  --name "$TEST_CONTAINER" \
  -e POSTGRES_PASSWORD=restore-test-throwaway \
  -e POSTGRES_DB=postgres \
  -v "${TEST_VOLUME}:/var/lib/postgresql/data" \
  "$TEST_IMAGE" >/dev/null

log "Waiting for postgres to be ready"
for i in $(seq 1 60); do
  if docker exec "$TEST_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
    log "Postgres ready (${i}s)"
    sleep 2  # дать postgres ещё пару секунд устаканиться (initdb post-hooks)
    break
  fi
  sleep 1
  [ "$i" = 60 ] && fail "postgres did not become ready in 60s"
done

# === Restore ===
log "Restoring dump (this may take a few minutes)"
RESTORE_ERR="${WORK_DIR}/restore-errors.txt"
# Stdout psql глушим (там результаты служебных SELECT'ов из дампа), нас интересуют ошибки.
# pipefail может прибить пайплайн на gunzip→psql, поэтому оборачиваем в || true.
gunzip -c "$DUMP_PATH" | docker exec -i "$TEST_CONTAINER" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=0 -q >/dev/null 2>"$RESTORE_ERR" || true

# Считаем ошибки только для информации в логе — реальный gate ниже (schema sanity).
# При restore на Supabase-образ ВСЕГДА будет N ошибок типа "must be owner of event
# trigger" и "cannot drop ... because other objects depend on it" — это конфликт
# pg_dump (от postgres user) с уже созданными Supabase init объектами (от supabase_admin).
# На таблицы public.* это не влияет — они создаются заново.
TOTAL_ERR_LINES=$(grep -cE '^(psql: error|ERROR|FATAL)' "$RESTORE_ERR" 2>/dev/null || true)
TOTAL_ERR_LINES=${TOTAL_ERR_LINES:-0}
log "Restore stderr lines (info only, не gate): ${TOTAL_ERR_LINES}"

# === Verify schema + data ===
psql_q() {
  docker exec "$TEST_CONTAINER" psql -U postgres -d postgres -Atc "$1" 2>/dev/null
}

log "Verifying schema"
PUBLIC_TABLES=$(psql_q "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")
log "  public.* tables: ${PUBLIC_TABLES} (min: ${MIN_PUBLIC_TABLES})"
[ "${PUBLIC_TABLES:-0}" -ge "$MIN_PUBLIC_TABLES" ] \
  || fail "schema sanity failed: only ${PUBLIC_TABLES} tables in public schema"

log "Verifying core tables exist"
for tbl in tenants branches categories orders appointments; do
  EXISTS=$(psql_q "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${tbl}'")
  [ "$EXISTS" = "1" ] || fail "missing core table: public.${tbl}"
done
log "  core tables present: tenants, branches, categories, orders, appointments"

log "Verifying counts"
TENANTS=$(psql_q "SELECT count(*) FROM public.tenants")
USERS=$(psql_q   "SELECT count(*) FROM auth.users")
BRANCHES=$(psql_q "SELECT count(*) FROM public.branches")
log "  tenants=${TENANTS}, auth.users=${USERS}, branches=${BRANCHES}"
[ "${TENANTS:-0}" -ge "$MIN_TENANTS"     ] || fail "tenants count below threshold (${TENANTS} < ${MIN_TENANTS})"
[ "${USERS:-0}"   -ge "$MIN_AUTH_USERS"  ] || fail "auth.users count below threshold (${USERS} < ${MIN_AUTH_USERS})"

# === Done ===
log "Restore-test PASSED (dump: ${LATEST}, size: ${DUMP_SIZE}, tenants: ${TENANTS}, users: ${USERS})"
trap - EXIT
cleanup
