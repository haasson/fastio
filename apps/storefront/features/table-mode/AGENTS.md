# table-mode — заметка для агента

QR-меню в заведении: гость сканит QR на столе, видит свой чек (позиции, статусы из кухни), вызывает официанта и при желании догоняет заказ.

## Что модуль делает

Хранит `tableId`/`tableName` + список `checkItems` (позиции, заказанные за этим столом) + локальный `draftItems` (что гость собирает прямо сейчас, ещё не отправлено) в Pinia-сторе. Realtime-композабл слушает события в таблицах `order_items` и `kitchen_queue`, дёргает `onChange` при изменении — страница перезапрашивает чек. Параллельно poll каждые 30s как fallback.

Поток заказа: тап блюда → `addDraftItem` (без POST, копится локально). Гость правит драфт (qty +/−, удаление) в шторке «Ваш заказ», жмёт «Отправить заказ» → ОДИН `POST /api/orders` со всем драфтом → `clearDraft` + `loadCheck`. Драфт (редактируемый) и `checkItems` (read-only, по статусам кухни) показываются раздельно в одной шторке.

Активные позиции: status ∈ {pending, confirmed}. Статусы из кухни (`kitchenStatus`): queued → in_progress → done → served.

Вызов официанта: гость нажимает кнопку в header layout (`CallWaiterButton`), endpoint `POST /api/table/[id]/call` пишет в `table_calls`, админка слышит через realtime-канал `useTableCallsChannel` (см. `apps/admin/features/tables`). Типы вызовов настраиваются тенантом в `table_call_types` (счёт / дозаказ / помощь и т.д.); если их >1 — кнопка открывает bottom-sheet с выбором, иначе шлёт generic «Вызвать официанта».

## Карта модуля

| Файл | Что внутри |
|---|---|
| `stores/table.ts` | `useTableStore` — state стола (id, name, `checkItems`, `draftItems`, computed `checkTotal/itemCount/draftCount/draftTotal`) + `setTable/setCheckItems/addDraftItem/updateDraftQty/removeDraftItem/removeDraftByKeys/clearDraft/clear`. Драфт дедупится по `draftSignature` (qty++ для одинаковой позиции; строже корзины — учитывает comboId). `removeDraftByKeys(Set)` удаляет ровно отправленные позиции после успешного POST (snapshot против потери добавленного во время отправки). |
| `composables/useTableRealtime.ts` | Подписка на realtime + 30s-poll. Принимает `tenantId` + callback `onChange`. |
| `components/TableCheckItem.vue` | Одна строка отправленного чека (название + модификаторы + addons + статус), read-only |
| `components/TableDraftItem.vue` | Одна строка драфта (редактируемая): qty +/− степлер, удаление, сумма позиции |
| `components/TableOrderBar.vue` | Морфящаяся нижняя полоса заказа. Покой: «Чек · сумма» во всю ширину (→ open-check). При непустом драфте Чек стягивается в пилюлю слева, справа выезжает primary «К заказу · сумма» (→ open-draft). Морф через `width`-transition + кросс-фейд контента. Прячется когда чек и драфт пусты. Props: checkCount/checkTotal/draftCount/draftTotal. |
| `components/CallWaiterButton.vue` | Кнопка вызова официанта в header layout. Грузит `/api/table/[id]/call-types` (типы + текст/иконка кнопки из table_settings). При >1 типов — FsDrawer-выбор. Текст/иконка настраиваются в admin (Столы→Настройки), дефолт — колокольчик + «Официант». Кнопка НЕ блокируется кулдауном — частоту валидирует сервер, на 429 показывается тост с retryAfter. |

## Серверные endpoints (storefront)

| Путь | Что делает |
|---|---|
| `server/api/table/[id].get.ts` | Валидация стола + выставление cookie `fastio_table` (IDOR guard) |
| `server/api/table/[id]/check.get.ts` | Чек стола: order_items + kitchen статусы |
| `server/api/table/[id]/call-types.get.ts` | Типы вызова + конфиг кнопки (callButtonLabel/callButtonIcon из table_settings) |
| `server/api/table/[id]/call.post.ts` | Insert в `table_calls`. Cookie guard + rate-limit (окно = call_cooldown_seconds из table_settings, дефолт 30) + опц. `callTypeId` |

## Типовые задачи

- **Новый статус кухни:** enum в БД (миграция) + расширь `CheckItem.kitchenStatus` в `stores/table.ts` + UI цвета в компоненте.
- **Добавить кнопку «оплатить»:** на стороне сервера endpoint `/api/table/[id]/checkout` → клиент дёргает $fetch с `tableId`.
- **Новая колонка отображения:** правь `TableCheckItem.vue`.
- **Новый тип вызова:** добавь запись в `table_call_types` для тенанта в админке — UI кнопки автоматически переключится в режим выбора через FsDrawer.

## Антипаттерны (не делай так)

- ❌ Создавать второй realtime-канал на `order_items` или `kitchen_queue` — `useTableRealtime` уже даёт callback.
- ❌ Кешировать `checkItems` в localStorage — это live-state стола, кеш нерелевантен (другой гость на следующий день получит чужой чек).
- ❌ Импорт `~/features/table-mode/stores/table` снаружи модуля — через `~/features/table-mode` (barrel).
- ❌ `db.from('table_calls').insert()` в endpoint — Proxy запрещает. Нужен `db.crossTenant.from('table_calls').insert({tenant_id, ...})` с явным `tenant_id` в payload (RLS-политика проверяет валидный открытый стол).

## Куда расти

- Split-bill: разделить чек между гостями.
- Расширенный UI типов вызова с иконками (FsAlert/FsBadge для urgent-вызовов).
