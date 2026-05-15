#!/usr/bin/env bash
# Еженедельная чистка Docker build cache / dangling images / unused volumes.
# Coolify использует nixpacks builds — каждый redeploy создаёт snapshot
# с полным /nix/store, занимающий 2-3 GB. За пару дней активного дебага легко
# набирается 40-50 GB в /var/lib/containerd. Этот скрипт чистит всё что
# не использовалось последние 168h (7 дней) — оставляет recent images для
# быстрого rollback'а Coolify.
#
# Установка на VPS:
#   1. scp scripts/coolify/docker-cleanup.sh root@109.71.242.205:/usr/local/bin/fastio-docker-cleanup.sh
#   2. ssh root@109.71.242.205 'chmod +x /usr/local/bin/fastio-docker-cleanup.sh'
#   3. crontab -e — добавить (раз в неделю в 04:00 по UTC, не пересекается с pg_dump backup'ом в 03:00):
#        0 4 * * 0 /usr/local/bin/fastio-docker-cleanup.sh >> /var/log/fastio-docker-cleanup.log 2>&1

set -euo pipefail

log() { echo "[$(date -uIs)] $*"; }

BEFORE=$(df -B1 / | awk 'NR==2 {print $4}')

log "Free before: $(numfmt --to=iec "$BEFORE")"

log "Pruning containers + networks (always, no age filter)"
docker container prune -f >/dev/null
docker network prune -f >/dev/null

log "Pruning images unused > 168h"
docker image prune -a --filter "until=168h" -f >/dev/null

log "Pruning build cache > 168h"
docker builder prune -a --filter "until=168h" -f >/dev/null

# volumes prune НЕ ставим в default — может снести что-то нужное. Если хочется —
# раскомментируй, но проверь что Coolify-volumes имеют label/named и не попадут.
# docker volume prune -f >/dev/null

AFTER=$(df -B1 / | awk 'NR==2 {print $4}')
FREED=$((AFTER - BEFORE))

log "Free after:  $(numfmt --to=iec "$AFTER")"
log "Freed:       $(numfmt --to=iec "$FREED")"
