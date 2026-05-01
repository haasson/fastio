# Progress: Fastio

## What Works
- **Admin панель** — полностью рабочая: меню, заказы, кухня, столы, бронирования, акции, контент, внешний вид, настройки, команда, аккаунт
- **Визиты (онлайн-запись)** — визит = посещение клиентом в один бизнес-день, 1+ услуг с независимыми статусами. Инвариант «один бизнес-день» проверяется в БД через `compute_business_date` (учитывает overnight-смены филиала). Per-service экшены, split (через серию move_appointment), единая страница для создания и редактирования (дровер выпилен)
- **`useGate` — единая система контроля доступа** (2026-04-25): объединяет 7 слоёв (suspended / business type / plan / module toggle / role / config / compile-time flag). Возвращает `{enabled, reason}` для UI-баннеров с причиной отказа. Покрытие тестами: 27 кейсов матрицы приоритетов. Замигрирован весь admin (AppNav, orders, kitchen, menu, tables, reservations, team, settings, audit-log, banners). `useAccess` удалён.
- **Route-level гейтинг** (2026-04-25): `middleware/gate.global.ts` + `composables/plan/useGate.routes.ts` — закрывают прямой URL-доступ к закрытым секциям (выключенный модуль / нет прав / locked план). Используют ту же карту, что и `AppNav`.
- **Scheduled orders (заказы ко времени)** — admin + kitchen: секция "Запланировано" на странице заказов, панель "Скоро" в очереди кухни, pg_cron release, ручной early release, UiSlider для lead time
- **Мультитенантность** — полная: tenant_members, роли, RLS, switchTenant
- **Storefront** — рабочая витрина с секциями, галереей (PhotoSwipe), промокодами, SEO
- **Realtime** — заказы, кухня, столы обновляются в реальном времени
- **Edge Functions** — send-order-email, payment-webhook, add-custom-domain, invite-member, accept-invite, list-team
- **Design tokens** — packages/ui мигрирован на токены
- **KB контент** — 30+ markdown-файлов по всем разделам admin

## What's Left to Build / In Progress
- `apps/help` — публичная база знаний (в разработке)
- `packages/kb` — пакет KB (в разработке)
- AI-ассистент в admin (`apps/admin/pages/help.vue`) — в разработке
- Audit log — добавлен за feature flag, ещё не включён
- Билинг (`/account`) — в разработке

## Known Issues
- (обновлять по мере обнаружения)

## Evolution of Project Decisions
- Перешли с глобальных стилей на design tokens в packages/ui
- KB вынесен в отдельный пакет `@fastio/kb` для переиспользования в admin AI и help-приложении
- Auto-import отключён во всех Nuxt-приложениях для явного контроля зависимостей
