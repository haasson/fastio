# Phase 5: Operational Features - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Клиент, совершивший реальный заказ, может видеть его текущий статус по уникальной ссылке без авторизации, и может найти правовые документы в футере витрины.

Scope: OPS-02 (страница статуса заказа), OPS-03 (правовые страницы).
OPS-01 (транзакционный email) **отложен в backlog** — email при оформлении заказа не собирается, реализация невозможна.

</domain>

<decisions>
## Implementation Decisions

### OPS-01 — Транзакционный email (DEFERRED)

- **D-01:** OPS-01 перенесён в backlog. Причина: `customer_email` не обязателен при оформлении заказа и практически не собирается. Email-подтверждение невозможно без email-адреса. Требование требует сначала добавить поле email в checkout — это отдельная задача.

### OPS-02 — Страница статуса заказа

- **D-02:** Страница `/order/[id]` **уже полностью реализована** (`apps/storefront/pages/order/[id].vue`, 284 строки). Реализованы: IDOR-guard (guest_token или auth), отображение состава/сумм/доставки/статуса, polling каждые 15 сек с остановкой при завершении заказа.
- **D-03:** Checkout перенаправляет на `/order/${id}?t=${token}` — guest_token flow работает.
- **D-04:** Polling 15с — достаточно для MVP. Supabase Realtime с anon-клиентом (без логина) требует специальной RLS-политики, не стоит усложнять сейчас.
- **D-05:** Success criteria OPS-02 выполнены. Нужна только верификация в рамках execute-phase.

### OPS-03 — Правовые страницы

- **D-06:** `/privacy` уже существует и полна (`apps/storefront/pages/privacy.vue`). Ссылка в `SiteFooter.vue` уже есть (условная: `v-if="hasPrivacy"` = `isLegalInfoComplete`).
- **D-07:** Нужна новая страница `/terms` — оферта. Структура: аналогично `privacy.vue`, шаблонный текст с параграфами + данные тенанта из `legalInfo` (legalName, INN, OGRN, legalAddress, privacyEmail).
- **D-08:** Секции `/terms`: §1 Предмет договора, §2 Порядок оформления заказа, §3 Стоимость и оплата, §4 Доставка/самовывоз, §5 Права и обязанности, §6 Ответственность. Данные тенанта из `legalInfo` — в шапке страницы.
- **D-09:** `/terms` показывается только когда `isLegalInfoComplete(tenant.legalInfo)` — такая же логика как у privacy. Без полных реквизитов страницы нет.
- **D-10:** Ссылка "Оферта" добавляется в `SiteFooter.vue` через `<NuxtLink to="/terms">` рядом с существующей `/privacy`. `hasDocuments` computed обновляется: включает `/terms` в условие показа блока. `offerUrl` (внешняя ссылка) сохраняется — показывается, если задан, независимо от `/terms`.

### Claude's Discretion

- Точный HTML-текст оферты (параграфы 1–6) — стандартный юридический текст для food-delivery
- Styling `/terms` — скопировать стили из `privacy.vue`
- SEO-мета для `/terms` и `/privacy`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Существующие страницы и компоненты
- `apps/storefront/pages/order/[id].vue` — страница статуса заказа (уже готова, 284 строки)
- `apps/storefront/pages/privacy.vue` — политика конфиденциальности (модель для /terms)
- `apps/storefront/shared/ui/sections/SiteFooter.vue` — футер (добавить ссылку /terms)

### Типы и утилиты
- `packages/shared/src/types/tenant.ts` — `TenantLegalInfo`, `isLegalInfoComplete()`, `TenantContacts` (поле `offerUrl`)
- `apps/storefront/server/api/orders/[id].get.ts` — API статуса заказа (IDOR guard, guest_token логика)

### Checkout flow
- `apps/storefront/pages/checkout.vue` — редирект на `/order/${id}?t=${token}` после создания заказа
- `apps/storefront/server/api/orders.post.ts` — генерация `guest_token` при создании заказа

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `privacy.vue` — полная модель для структуры `/terms`: `useNuxtData('tenant')`, `computed(() => tenant.value?.legalInfo)`, условный рендер при `isLegalInfoComplete`, `StorePageLayout` с breadcrumbs
- `SiteFooter.vue` — уже содержит `hasDocuments` computed и `.doc-link` стили. Достаточно добавить `hasTerms` и `<NuxtLink to="/terms">`.
- `isLegalInfoComplete()` из `@fastio/shared` — единственный источник правды для показа правовых страниц.

### Established Patterns
- Данные тенанта в pages — через `useNuxtData<Tenant>('tenant')` (не `useFetch`), данные уже загружены layout'ом.
- Страницы без авторизации — не требуют `definePageMeta` с `auth`, работают на SSR как обычные Nuxt pages.
- Документы по-разному: `offerUrl` = внешний PDF, `/terms` = внутренняя страница с шаблоном.

### Integration Points
- `SiteFooter.vue` → `TenantContacts.offerUrl` (уже работает), нужно добавить → `/terms` route
- `/terms` page → `TenantLegalInfo` (те же поля что у `/privacy`)
- `hasDocuments` в футере объединяет показ блока документов — добавить `hasTerms` в условие

</code_context>

<specifics>
## Specific Ideas

- `/terms` по структуре = clone of `/privacy` с другим текстом и без `deliveryEnabled` условия
- Оба правовых документа в футере рядом: `Политика конфиденциальности | Оферта`
- `offerUrl` остаётся — если владелец загрузил внешний PDF, он тоже показывается

</specifics>

<deferred>
## Deferred Ideas

- **OPS-01 → backlog**: Транзакционный email-подтверждение заказа. Требует сначала добавить поле email в checkout (не обязательное, опциональное), затем реализовать Edge Function с Resend API или SMTP. Логика отправки — Edge Function через Postgres webhook на INSERT в orders (асинхронно).
- **Supabase Realtime для страницы заказа**: Обновление статуса через websocket вместо polling. Полезно когда появятся реальные клиенты с высокими ожиданиями. Требует RLS-политику на anon + guest_token pattern.

</deferred>

---

*Phase: 05-operational-features*
*Context gathered: 2026-05-23*
