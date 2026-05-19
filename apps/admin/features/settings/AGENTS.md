# settings — заметка для агента

Общие настройки тенанта (shared). Полная мета — `feature.manifest.ts`.

## Что модуль делает

Сборник «общих» настроек: контакты, уведомления, легал, модули. Большинство этих настроек хранится **в самом `tenants` через JSON-поля** (`contacts`, `notifications`, `legal`) — мутации идут через `tenantStore.update()`. Отдельная таблица только `module_configs` для конфигов конкретных модулей (например, настройки авто-статусов заказов).

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/module-configs.ts` | CRUD `module_configs`: get/upsert per-module JSON-конфиг |
| `api/telegram-link.ts` | Привязка tg-чатов: `upsertCode` (одноразовый код), `listSubscribers` (для polling/UI), `removeSubscriber` (отвязка) |
| `composables/useNotificationPrefs.ts` | UI-state блока уведомлений + связь с `tenants.notifications` |
| `components/*` | Модальные/inline-блоки: модули, биллинг-окошко, доставка, контакты, рабочие часы. Импорт deep-path |
| `components/TelegramConnectModal.vue` | Модалка подключения tg-чата (DM/группа) с QR + ожиданием подключения. Pure presentational: state polling/justConnected/QR прокидывается из `pages/settings/notifications.vue` через props |

## Типовые задачи

- **Новая настройка тенанта (простое поле):** добавь поле в `tenants` через миграцию + расширь `Tenant` тип + UI в подходящем разделе → мутация через `tenantStore.update({ ... })`. **Не** заводи отдельную таблицу для одного поля.
- **Новый конфиг модуля (структурированный JSON):** используй `module_configs` (key='<module>', value=jsonb). Чтение через `api/module-configs.get(key)`, запись — `upsert(key, value)`.
- **Toggle модуля в `/settings/modules`:** в `shared/utils/moduleToggleChecks.ts` есть `canDisable<Module>()` — проверки блокеров (открытые заказы, активные брони). При попытке выключить — UI спросит подтверждение и покажет, что мешает.

## Telegram-подписчики

Мульти-привязка: один тенант = N подписчиков (личные DM + группы), таблица `tenant_telegram_subscribers`. Привязку делает бот через handler `apps/admin/server/api/telegram/webhook.post.ts` (service-role INSERT). Чтение/отвязка через UI — `pages/settings/notifications.vue` + `api/telegram-link.ts`.

Рассылка идёт через хелпер `apps/admin/server/utils/telegramBroadcast.ts`:
- Параллельно шлёт всем подписчикам тенанта
- При «необратимом» отказе (бот заблокирован, кикнут, чат удалён) — подписчик авто-удаляется
- Используется в `notify.post.ts` и `notify-reservation.post.ts`

## Антипаттерны (не делай так)

- ❌ Класть гейты планов/модулей сюда — они в `shared/plan/`.
- ❌ Создавать отдельную таблицу под каждое «настроечное» поле — лей в `tenants.<json_field>` или `module_configs`.
- ❌ Дёргать `tenants.update()` напрямую через `sb.from('tenants').update()` — иди через `tenantStore` (там optimistic + аудит).

## Куда расти

Сложный workflow-конструктор уведомлений (триггеры/условия) — не в settings, отдельная фича `notifications-workflow`.
