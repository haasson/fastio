# Disaster Recovery — восстановление БД из бэкапа

> **Когда читать:** прямо сейчас, если БД дропнулась / порча данных / случайный
> `DROP TABLE` / неудачная миграция повредила схему.
> **Цель:** вернуть рабочую БД за 5-30 минут.

**Два уровня защиты, выбирай по ситуации:**

| Уровень | RPO | RTO | Когда использовать |
|---|---|---|---|
| **PITR через wal-g** | **~60 секунд** | 5-15 мин | Реальный production-инцидент, нельзя терять заказы между ночным dump'ом и моментом сбоя |
| **Logical restore из daily pg_dump** | 24 часа | 5-10 мин | Быстрый откат к чистому состоянию, тестовые сценарии, S3-WAL недоступен |

**Рекомендация:** при реальной потере данных всегда пробуй **PITR первым** —
он восстановит до секунды перед инцидентом. Если что-то пошло не так с
WAL'ами или нужна максимальная простота — fallback на pg_dump.

---

## Что есть для восстановления

| Файл/скрипт/путь | Что делает |
|---|---|
| **WAL archiving (continuous)** | `archive_command` → wal-g → S3 каждые 60s через `/etc/postgresql-custom/wal-push.sh` |
| `twS3:fastio-backups/wal-g/` | wal-g basebackups + WAL сегменты (brotli-сжатые) |
| `/usr/local/bin/fastio-walg-basebackup.sh` | Weekly воскресенье 02:30 UTC — базовый снимок БД |
| **`/usr/local/bin/fastio-restore-pitr.sh`** | **PITR restore — до точной секунды.** Этот скрипт — основной инструмент при инцидентах |
| `/usr/local/bin/fastio-backup.sh db` | Daily 03:00 UTC: `pg_dump → S3` (вторая линия защиты) |
| `/usr/local/bin/fastio-restore-prod.sh` | Logical restore из pg_dump (когда PITR не подходит / S3-WAL недоступны) |
| `/usr/local/bin/fastio-restore-test.sh` | Monthly 1 числа: автотест что dump восстанавливается + Telegram alert |
| `/var/backups/fastio/` | Локальные dump'ы и safety-snapshot'ы (PGDATA tar'ы, safety pg_dump'ы) |
| `/etc/postgresql-custom/wal-g.env` | S3 creds для wal-g (chmod 600 postgres:postgres) |
| `/etc/postgresql-custom/wal-g.conf` | `archive_mode=on`, `archive_timeout=60s`, restore_command |

Telegram-алерт о backup'е приходит каждый день в чат поддержки. Если за
последние 36 часов **не пришло** ✅-сообщение — backup сломался, восстановление
**уже под угрозой**, начинай разбираться с этим прежде чем ждать инцидента.

---

## ⭐ Сценарий 1 (PITR): «Минуту назад был DROP TABLE / DELETE без WHERE — нужно откатить»

**Это основной production-сценарий.** PITR через wal-g даёт восстановление
до **точной секунды** перед инцидентом — заказы, пришедшие за минуту до сбоя,
сохраняются.

### Шаги

```bash
# 1. SSH на VPS
ssh root@109.71.242.205

# 2. Определи момент ДО инцидента (TIMESTAMP)
# Например: бага в 14:25:10 UTC → восстанавливаем до 14:25:00 UTC
# Найти точный момент можно через:
#   docker exec $(docker ps --format '{{.Names}}' | grep supabase-db) \
#     psql -U postgres -c "SELECT created_at FROM audit_logs ORDER BY created_at DESC LIMIT 20;"

# 3. Посмотри какие basebackup'ы доступны (PITR использует ближайший к target_time)
docker exec -u postgres $(docker ps --format '{{.Names}}' | grep supabase-db) \
  bash -c 'source /etc/postgresql-custom/wal-g.env && wal-g backup-list'

# 4. Запусти PITR-restore с timestamp
fastio-restore-pitr.sh '2026-05-20 14:25:00 UTC'

# Скрипт спросит подтверждение — ввести ТОЧНО: yes-restore-pitr
```

### Что произойдёт автоматически

1. **Safety pg_dump** текущей БД + **PGDATA tar** в `/var/backups/fastio/` — на случай если PITR пойдёт не так
2. Остановка Nuxt-приложений + Supabase-сервисов (auth, rest, realtime)
3. Остановка supabase-db контейнера
4. **Wipe PGDATA volume**
5. wal-g скачивает latest basebackup из S3 в PGDATA
6. Создаётся `recovery.signal` + `recovery_target_time` в `postgresql.auto.conf`
7. Старт supabase-db → Postgres **сам применит WAL'ы** из S3 через `restore_command` до указанной секунды и сделает promote
8. Старт приложений обратно
9. Sanity-check + Telegram alert

### Время выполнения

**5-15 минут** на текущем объёме БД (~2 MB compressed basebackup + N WAL сегментов).
Дольше всего занимает применение WAL'ов — пропорционально количеству изменений
между basebackup'ом и target_time.

### Откат если PITR пошёл не так

PGDATA backup из шага 4 + safety pg_dump в `/var/backups/fastio/pre-pitr-*` —
можно вернуть `tar -xzf pgdata-pre-pitr-*.tar.gz -C /var/lib/docker/volumes/`
и стартовать БД с pre-PITR состоянием.

---

## Сценарий 2 (Logical restore): «Откатить до состояния вчерашней ночи»

Используется когда нужен **чистый dump** без WAL-replay (например тестовые
сценарии, S3-WAL недоступен, или просто хочется откат к стабильной точке).
RPO 24 часа — потеряется всё с момента последнего daily dump (03:00 UTC).

### Шаги

```bash
# 1. SSH на VPS
ssh root@109.71.242.205

# 2. Посмотреть какие dump'ы доступны
fastio-restore-prod.sh list

# Покажет последние 10 dump'ов вида:
#   2026-05-20  03:00:03  postgres-20260520-030002.sql.gz
#   2026-05-19  03:00:03  postgres-20260519-030002.sql.gz

# 3. Выбрать dump (обычно самый свежий — до момента инцидента)
fastio-restore-prod.sh postgres-20260520-030002.sql.gz

# Скрипт спросит подтверждение — нужно ввести ТОЧНО: yes-restore-prod
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

## Сценарий 3: «БД не запускается / контейнер supabase-db мёртв»

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

## Сценарий 4: «Откат restore'а — выбрали не тот dump»

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

## Сценарий 5: «S3 недоступен»

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

## Архитектура wal-g setup (для справки)

**Что включено (2026-05-20, PREPROD-141):**

```
Postgres (supabase-db-XXX)
   ↓ archive_command каждые 60s
/etc/postgresql-custom/wal-push.sh
   ↓ source /etc/postgresql-custom/wal-g.env
/usr/local/bin/wal-g wal-push (ship'ится в supabase/postgres:15.8 из коробки)
   ↓ brotli compression + PUT
S3: twS3:fastio-backups/wal-g/
        ├── basebackups_005/       ← weekly basebackup (полный снимок БД)
        └── wal_005/               ← непрерывный поток WAL-сегментов
```

**Compression:** brotli (default wal-g). Сжимает WAL'ы в 3-5 раз.

**Storage cost (текущий объём):**
- Basebackup: ~10-50 MB sjatый (БД пока совсем маленькая)
- WAL: 16 MB / сегмент × несколько в сутки → ~50-200 MB/неделя
- **Итого: <1 GB/мес = ₽1-2/мес** в Timeweb S3

**Retention:**
- Basebackup: 4 последних (управляется `wal-g delete retain` в weekly cron)
- WAL-сегменты: автоматически чистятся wal-g при `delete retain` (всё что
  старше самого старого basebackup'а становится не нужным)

**Что НЕ восстанавливается через PITR:**
- **Storage (фото блюд, баннеры)** — отдельный bucket `twS3:fastio-storage`,
  weekly snapshot
- **Edge Functions код** — в репе на GitHub, redeploy через Coolify
- **Coolify config** — отдельная БД `coolify-db`
