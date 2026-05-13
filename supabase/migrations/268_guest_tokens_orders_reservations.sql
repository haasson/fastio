-- IDOR guard для гостевых заказов и броней: `/api/orders/[id]` и `/api/reservations/[id]`
-- сейчас отдают любой ресурс внутри тенанта тому, кто знает UUID. UUID v4 не угадывается,
-- но он утекает (Realtime, push, email, логи) и в ответе — PII клиента (phone, address).
--
-- Защита: при создании ресурса гостем (customer_id IS NULL) генерим случайный `guest_token`,
-- возвращаем его клиенту и требуем при чтении. Для залогиненных customer'ов работает второй
-- путь — match по auth.users → customers.auth_user_id. Логика guard'а — в endpoint'ах.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS guest_token uuid;

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS guest_token uuid;

-- Lookup'ы делаем по (id, guest_token) — обычные индексы по id уже есть (PK),
-- доп. индекс по guest_token не нужен: основной фильтр идёт по id.
-- Уникальность guest_token не требуется (id и так уникален), хватает sparseness.

-- Сам token не PII: он эфемерный, не дамп-уровень, не индексируем.
COMMENT ON COLUMN orders.guest_token IS 'IDOR guard для guest-заказов: возвращается при создании, требуется в ?t= при чтении. Заполнен только когда customer_id IS NULL.';
COMMENT ON COLUMN reservations.guest_token IS 'IDOR guard для guest-броней: возвращается при создании, требуется в ?t= при чтении. Заполнен только когда customer_id IS NULL.';
