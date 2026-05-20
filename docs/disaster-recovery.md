# Disaster Recovery — восстановление БД из бэкапа

> **Когда читать:** прямо сейчас, если БД дропнулась / порча данных / случайный
> `DROP TABLE` / неудачная миграция повредила схему.
> **Цель:** вернуть рабочую БД из последнего ежедневного бэкапа за 15-30 минут.

**RPO (Recovery Point Objective):** до 24 часов. Все изменения с момента
последнего ежедневного `pg_dump` (03:00 UTC) **потеряются**. Чтобы окно
было ~60 секунд — нужен wal-g (см. в конце документа).

**RTO (Recovery Time Objective):** 15-30 минут на текущем объёме БД (1-2 MB
compressed). С ростом данных растёт линейно — миллион заказов всё равно
восстановится за полчаса.

---

## Что есть для восстановления

| Файл/скрипт | Что делает |
|---|---|
| `/usr/local/bin/fastio-backup.sh db` | Daily 03:00 UTC: `pg_dump → S3 (twS3:fastio-backups)` |
| `/usr/local/bin/fastio-restore-test.sh` | Monthly 1 числа: restore в temp Postgres, проверка схемы |
| `/usr/local/bin/fastio-restore-prod.sh` | **Production restore** — см. эту инструкцию |
| `/var/backups/fastio/` | Локальные dump'ы за последние 7 дней (S3 retention — 30 дней) |
| `twS3:fastio-backups/postgres-*.sql.gz` | Daily dumps в Timeweb S3 |

Telegram-алерт о backup'е приходит каждый день в чат поддержки. Если за
последние 36 часов **не пришло** ✅-сообщение — backup сломался, восстановление
**уже под угрозой**, начинай разбираться с этим прежде чем ждать инцидента.

---

## Сценарий 1: «БД работает, но данные кривые / случайно дропнули таблицу»

Это типичный кейс: миграция уехала с багом, человек выполнил
`DELETE FROM orders` без `WHERE`, тестовый прогон сидинга затёр прод.
БД сама работает, контейнер живой — но данные неправильные.

### Шаги

```bash
# 1. SSH на VPS
ssh root@109.71.242.205

# 2. Посмотреть какие dump'ы доступны
fastio-restore-prod.sh list

# Покажет последние 10 dump'ов вида:
#   2026-05-20  03:00:03  postgres-20260520-030002.sql.gz
#   2026-05-19  03:00:03  postgres-20260519-030002.sql.gz
#   ...

# 3. Выбрать dump (обычно самый свежий — до момента инцидента)
fastio-restore-prod.sh postgres-20260520-030002.sql.gz

# Скрипт спросит подтверждение — нужно ввести ТОЧНО: yes-restore-prod
# Любое другое слово = отмена.
```

### Что произойдёт автоматически

1. **Safety snapshot** — текущая БД сохранится в `/var/backups/fastio/pre-restore-YYYYMMDD-HHMMSS.sql.gz`. **Это страховка** — если restore из выбранного dump'а тебя не устроит, можно откатиться к состоянию до restore (см. ниже «Откат»).
2. **Останавливаются Nuxt-приложения** (admin/storefront/help/landing/backoffice). Supabase-стек остаётся работать — нужен `psql` для restore.
3. **Dump скачивается из S3** + проверка gzip integrity.
4. **Restore через psql** — `pg_dump --clean --if-exists` сам дропает старые таблицы и создаёт новые. Это безопасно — Supabase-расширения (`auth`, `storage`, `realtime`) остаются нетронутыми.
5. **Sanity-check** — проверка что в `public.*` >= 50 таблиц, читаются `tenants` и `auth.users`.
6. **Запускаются Nuxt-приложения** обратно.
7. **Telegram alert** с результатом.

### Время выполнения

Текущий размер БД: ~2 MB compressed. Время: **5-10 минут** включая остановку/запуск контейнеров. По мере роста БД до GB — линейный рост.

---

## Сценарий 2: «БД не запускается / контейнер supabase-db мёртв»

Скрипт `fastio-restore-prod.sh` **не сработает** — он нуждается в работающем
`supabase-db-*` контейнере для `psql`. Сначала надо привести контейнер в
рабочее состояние.

### Шаги

```bash
# 1. Проверить логи контейнера
docker logs --tail 100 $(docker ps -a --format '{{.Names}}' | grep supabase-db)

# 2a. Если контейнер просто упал (но volume цел) — рестартим
docker restart $(docker ps -a --format '{{.Names}}' | grep supabase-db)
# Ждём 60 секунд и проверяем
docker exec $(docker ps --format '{{.Names}}' | grep supabase-db) pg_isready -U postgres

# 2b. Если volume повреждён или данные потеряны — нужен Coolify redeploy
# Заходим в Coolify UI: https://coolify.fastio.ru
# Идём в Supabase project → Settings → Stop / Restart
# (Это пересоздаст контейнер с тем же volume — данные сохранятся если volume цел)

# 3. Когда контейнер запущен — гоним restore как в Сценарии 1
fastio-restore-prod.sh latest
```

### Если volume полностью потерян (worst-case)

```bash
# 1. В Coolify UI: пересоздать Supabase-стек с нуля (это потеря всех данных, кроме
#    последнего dump'а на S3)
# 2. После того как новый supabase-db поднимется
fastio-restore-prod.sh latest
```

---

## Сценарий 3: «Откат restore'а — выбрали не тот dump»

Каждый `fastio-restore-prod.sh` создаёт safety snapshot ДО restore. Он лежит в
`/var/backups/fastio/pre-restore-*.sql.gz`. Чтобы откатиться:

```bash
# Найти safety snapshot
ls -la /var/backups/fastio/pre-restore-*.sql.gz

# Применить его (тот же механизм что и production restore, но из локального файла)
DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep supabase-db | head -1)
gunzip < /var/backups/fastio/pre-restore-YYYYMMDD-HHMMSS.sql.gz \
  | docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres
```

⚠ Откат через safety-snapshot возможен только если оригинальный (pre-restore)
state БД был валидным. Если safety-snapshot сделан с уже сломанной БД — откат
не поможет.

---

## Сценарий 4: «S3 недоступен»

Если Timeweb S3 не отвечает (network outage с их стороны), есть локальные
dump'ы за последние 7 дней:

```bash
# Список локальных dump'ов
ls -la /var/backups/fastio/postgres-*.sql.gz

# Restore из локального dump'а (обходим S3)
DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep supabase-db | head -1)
gunzip < /var/backups/fastio/postgres-YYYYMMDD-HHMMSS.sql.gz \
  | docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres
```

Не забудь сначала остановить Nuxt-приложения вручную:
```bash
docker ps --format '{{.Names}}' | grep -vE '^supabase-|^coolify-|^realtime-' | xargs docker stop
# ... restore ...
docker ps --format '{{.Names}}' | grep -vE '^supabase-|^coolify-|^realtime-' | xargs docker start
```

---

## Что проверить после restore

```bash
# В Supabase Studio (https://supabase.fastio.ru) или через psql:
DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep supabase-db | head -1)
docker exec -it "$DB_CONTAINER" psql -U postgres -d postgres

# Внутри psql:
SELECT count(*) FROM tenants;
SELECT count(*) FROM auth.users;
SELECT count(*) FROM orders WHERE created_at > now() - interval '7 days';
SELECT max(created_at) FROM orders;
\q
```

Цель проверки — убедиться что данные действительно восстановились и timestamp
последнего заказа соответствует моменту дампа (03:00 UTC = 09:00 МСК = 12:00
Барнаул для daily backup'а).

**Откройте admin.fastio.ru** и проверьте:
- Логин работает
- Список заказов / меню — есть
- Telegram-уведомления приходят

---

## Что НЕ восстанавливается из этого dump'а

- **Storage (фото блюд, баннеры)** — хранится в отдельном S3 bucket
  `twS3:fastio-storage`. Бэкапится отдельно еженедельно через
  `fastio-backup.sh storage` → `twS3:fastio-backups/storage-YYYY-MM-DD/`.
  Restore — через `rclone copy` из бэкапа в основной bucket. См. отдельный
  runbook (TBD).
- **Edge Functions код** — он в репе на GitHub, не в БД. Redeploy через
  Coolify.
- **Coolify config** — отдельная БД `coolify-db`, бэкапится в Coolify-настройках.
- **Vault secrets** (`telegram_internal_secret` и т.д.) — они в `vault.secrets`,
  входят в БД-dump. Восстановятся вместе с public-схемой.

---

## Тестирование runbook'а

Раз в месяц **automatic restore-test** прогоняется кроном (`fastio-restore-test.sh`)
— скачивает свежий dump, поднимает изолированный Postgres-контейнер,
делает restore, проверяет схему. На fail приходит Telegram-alert.

Этот тест **не проверяет** прод-restore через `fastio-restore-prod.sh`. Чтобы
проверить **end-to-end runbook** — раз в квартал делать прогон на staging
(если будет) или симуляцию с recreate prod из самого свежего snapshot'а
в нерабочее время.

---

## Будущее: wal-g для PITR (RPO 60 секунд)

Текущий setup даёт RPO 24h — заказы между 03:00 и моментом инцидента теряются.
Для production с реальными клиентами это **неприемлемо**.

wal-g — это continuous WAL archiving. Каждый 16 MB сегмент WAL копируется в S3
по мере заполнения (минимум раз в `archive_timeout = 60s`). При restore можно
указать точную секунду до инцидента — Point-In-Time Recovery (PITR).

**Что даёт:**
- RPO 60s вместо 24h
- Восстановление до **любой секунды** в пределах retention периода

**Что стоит:**
- ~₽10/мес дополнительного S3-storage
- 30 сек downtime для restart Postgres при включении (один раз)
- Сложность инфры +1

**Когда делать:** до первого платного клиента. Сейчас задача PREPROD-141
в плане pre-prod (`docs/plans/2026-05-17-pre-prod/stage-1-important.md`).
