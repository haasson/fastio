# Tech Context: Fastio

## Technologies Used
- **Monorepo:** pnpm workspaces + Turborepo
- **Frontend:** Nuxt 3 (admin: SPA/ssr:false, storefront: SSR, help: SSR)
- **UI:** @fastio/ui (обёртки над Naive UI) + @fastio/styles (design tokens, mixins)
- **State:** Pinia (setup API), composables
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions)
- **Edge Functions:** Deno (send-order-email, payment-webhook, add-custom-domain, invite-member, accept-invite, list-team)
- **Types:** @fastio/shared (TypeScript типы: menu, order, tenant, promotion…)
- **Icons:** @fastio/icons
- **KB:** @fastio/kb (структура и markdown-контент базы знаний)

## Development Setup
```bash
pnpm dev              # admin + storefront одновременно
pnpm dev:admin        # только admin (порт 4710)
pnpm dev:storefront   # только storefront
pnpm dev:help         # только help (порт 4712)
pnpm build            # сборка монорепо
pnpm typecheck        # проверка типов
pnpm lint             # ESLint
pnpm lint:style       # Stylelint
pnpm test:run         # vitest однократно
pnpm supabase:start   # локальный Supabase (Docker)
```

## Technical Constraints
- Auto-import в Nuxt **отключён** — всё импортировать явно
- Компоненты @fastio/ui — читать исходник перед использованием, не угадывать пропсы
- Стили только в scoped styles, не БЭМ, корневой класс с постфиксом `-root`
- `type` вместо `interface` в TypeScript
- **НИКОГДА не запускать `supabase db reset`** — дропает всю базу

## Data Flow Pattern
`pages` → `composables/data/*` → `utils/api/*` → Supabase

- `utils/api/*.ts` — CRUD к Supabase, маппинг row→domain, требует `sb: SupabaseClient` первым аргументом
- `useSupabaseApi()` — DI-слой, биндит `sb`, агрегирует модули
- `composables/use*.ts` — бизнес-логика + реактивность
- `stores/*.ts` — глобальное состояние (auth, tenant, branch)
- Компоненты — только рендер, никаких прямых вызовов api.*
