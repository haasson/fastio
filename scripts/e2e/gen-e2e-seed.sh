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

# Локальный дрейф: колонки, существующие в живой локальной базе, но ОТСУТСТВУЮЩИЕ в
# миграциях (а значит и на CI/проде). Мёртвые — не используются кодом. Исключаем,
# иначе COPY падает на схеме, построенной из миграций.
# Как найдено: прогон всех миграций в чистую scratch-базу через psql + дифф
# information_schema.columns против живой (см. git-историю фикса).
# Если миграция позже добавит колонку — убрать её из drift_cols() и перегенерировать.
# (bash 3.2 на macOS — без ассоциативных массивов, через case.)
drift_cols() {
  case "$1" in
    reservation_settings) echo "'resource_selection_enabled','conflict_mode','default_slot_duration'" ;;
    *) echo "" ;;
  esac
}

# Таблицы в топологическом (FK-безопасном) порядке: "schema.table|filter_expr".
# auth.users/identities фильтруются по членам тенантов; tenants по id; остальное по tenant_id.
MEMBER_FILTER="user_id IN (SELECT user_id FROM public.tenant_members WHERE tenant_id IN ('$DEMO','$SVC'))"
# Appointment-таблицы привязки/расписаний ключуются по resource_id (нет tenant_id) —
# фильтруем через ресурсы тенантов. Без них слот-движок не видит часов мастеров и
# связь услуга↔мастер → ноль слотов на витрине (см. appointment-flow.spec.ts).
RES_FILTER="resource_id IN (SELECT id FROM public.resources WHERE tenant_id IN ('$DEMO','$SVC'))"
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
  "public.resource_branches|$RES_FILTER"
  "public.resource_categories|$RES_FILTER"
  "public.resource_schedules|$RES_FILTER"
  "public.service_resources|$RES_FILTER"
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

    excl=""
    drift=$(drift_cols "$name")
    if [ -n "$drift" ]; then excl=" AND column_name NOT IN ($drift)"; fi
    cols=$("${PSQL_AT[@]}" -c "SELECT string_agg(quote_ident(column_name), ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='$schema' AND table_name='$name' AND is_generated <> 'ALWAYS'$excl;")

    echo "-- $tbl"
    echo "COPY $tbl ($cols) FROM stdin;"
    docker exec -i "$C" psql -U postgres -d postgres -c "\copy (SELECT $cols FROM $tbl WHERE $filter) TO STDOUT"
    echo "\\."
    echo
  done

  echo "COMMIT;"
  echo "SET session_replication_role = origin;"
  echo
  echo "-- Post-seed override: demo-тенант круглосуточно (allDay). order-flow.spec.ts не должен"
  echo "-- зависеть от времени суток: крон ночнушки 22:33 UTC = 05:33 Asia/Krasnoyarsk попадает"
  echo "-- в закрытое окно 03:00–12:00 → branches.working_hours фолбэчатся на tenant.working_hours"
  echo "-- (branches.get.ts) → pickup-карточки disabled → 15s timeout. allDay снимает зависимость."
  echo "UPDATE public.tenants SET working_hours_schedule = '{\"days\": {}, \"default\": {\"open\": \"00:00\", \"close\": \"00:00\", \"allDay\": true}}' WHERE id = '$DEMO';"
} > "$OUT"

echo "WROTE $OUT"
wc -l "$OUT"
