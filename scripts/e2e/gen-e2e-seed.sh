#!/usr/bin/env bash
# Генератор supabase/seed/e2e-ci.sql — config-faithful дамп тенантов demo (retail) +
# services-start (services) из ЖИВОЙ локальной базы. Воспроизводит состояние, на котором
# проходят tests/e2e/*. Без транзакционной истории (orders/appointments/reservations
# создаются самими тестами; setup.mjs чистит marker-данные).
#
# Запуск: bash scripts/e2e/gen-e2e-seed.sh  (нужен поднятый локальный supabase + тенанты
# demo/services-start с фикс. UUID). Перегенерируй и коммить e2e-ci.sql при изменении
# структуры тенантов, на которой гоняются e2e.
#
# Как работает: COPY-блоки (формат pg_dump — пуленепробиваемо для jsonb/массивов/timestamp)
# в FK-безопасном порядке. На загрузке триггеры отключаются (session_replication_role=replica)
# — снимает порядок FK и побочки авто-триггеров; данные внутренне консистентны.
set -euo pipefail

C="supabase_db_fastio"
DEMO="00000000-0000-0000-0000-000000000002"
SVC="b1000000-0000-0000-0000-000000000005"
OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/supabase/seed/e2e-ci.sql"

PSQL_AT=(docker exec -i "$C" psql -U postgres -d postgres -At)

# Таблицы в топологическом (FK-безопасном) порядке: "schema.table|filter_expr".
# auth.users/identities фильтруются по членам тенантов; tenants по id; остальное по tenant_id.
MEMBER_FILTER="user_id IN (SELECT user_id FROM public.tenant_members WHERE tenant_id IN ('$DEMO','$SVC'))"
TABLES=(
  "auth.users|id IN (SELECT user_id FROM public.tenant_members WHERE tenant_id IN ('$DEMO','$SVC'))"
  "auth.identities|$MEMBER_FILTER"
  "public.tenants|id IN ('$DEMO','$SVC')"
  "public.tenant_roles|tenant_id IN ('$DEMO','$SVC')"
  "public.tenant_members|tenant_id IN ('$DEMO','$SVC')"
  "public.branches|tenant_id IN ('$DEMO','$SVC')"
  "public.tables|tenant_id IN ('$DEMO','$SVC')"
  "public.table_call_types|tenant_id IN ('$DEMO','$SVC')"
  "public.schedule_templates|tenant_id IN ('$DEMO','$SVC')"
  "public.dish_tags|tenant_id IN ('$DEMO','$SVC')"
  "public.categories|tenant_id IN ('$DEMO','$SVC')"
  "public.dishes|tenant_id IN ('$DEMO','$SVC')"
  "public.dish_tag_assignments|tenant_id IN ('$DEMO','$SVC')"
  "public.modifier_groups|tenant_id IN ('$DEMO','$SVC')"
  "public.addons|tenant_id IN ('$DEMO','$SVC')"
  "public.addon_presets|tenant_id IN ('$DEMO','$SVC')"
  "public.combos|tenant_id IN ('$DEMO','$SVC')"
  "public.services|tenant_id IN ('$DEMO','$SVC')"
  "public.resources|tenant_id IN ('$DEMO','$SVC')"
  "public.resource_unavailability|tenant_id IN ('$DEMO','$SVC')"
  "public.appointment_settings|tenant_id IN ('$DEMO','$SVC')"
  "public.reservation_settings|tenant_id IN ('$DEMO','$SVC')"
  "public.order_statuses|tenant_id IN ('$DEMO','$SVC')"
  "public.order_number_counters|tenant_id IN ('$DEMO','$SVC')"
  "public.delivery_zones|tenant_id IN ('$DEMO','$SVC')"
)

{
  echo "-- ============================================================================="
  echo "-- FASTIO E2E CI SEED — config-faithful дамп тенантов demo (retail) + services-start (services)"
  echo "-- ============================================================================="
  echo "-- АВТОГЕНЕРАЦИЯ: scripts/e2e/gen-e2e-seed.sh. Руками не править — перегенерируй."
  echo "-- Применяется в CI (e2e-smoke.yml / e2e-nightly.yml) на свежую базу после supabase start,"
  echo "-- ДО globalSetup (scripts/e2e/setup.mjs), который досоздаёт customer/session и ресетит пароль."
  echo "-- Воспроизводит локальное состояние, на котором проходят tests/e2e/*. Без транзакционной"
  echo "-- истории. Триггеры отключены на время загрузки (session_replication_role=replica)."
  echo "-- НЕ для прода — синтетические demo-данные."
  echo "-- ============================================================================="
  echo
  echo "SET session_replication_role = replica;"
  echo "BEGIN;"
  echo

  for entry in "${TABLES[@]}"; do
    tbl="${entry%%|*}"
    filter="${entry#*|}"
    schema="${tbl%%.*}"
    name="${tbl#*.}"

    cols=$("${PSQL_AT[@]}" -c "SELECT string_agg(quote_ident(column_name), ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='$schema' AND table_name='$name' AND is_generated <> 'ALWAYS';")

    echo "-- $tbl"
    echo "COPY $tbl ($cols) FROM stdin;"
    docker exec -i "$C" psql -U postgres -d postgres -c "\copy (SELECT $cols FROM $tbl WHERE $filter) TO STDOUT"
    echo "\\."
    echo
  done

  echo "COMMIT;"
  echo "SET session_replication_role = origin;"
} > "$OUT"

echo "WROTE $OUT"
wc -l "$OUT"
