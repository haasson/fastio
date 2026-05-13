# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# FastFood SaaS — Инструкции для AI

## TECHDEBT.md и LATER.md

Два специальных файла в директории автопамяти (рядом с `MEMORY.md`):

**`TECHDEBT.md`** — технический долг: известный кривой/мёртвый/временный код, который нужно убрать или переделать, но отложили.

Писать туда когда:
- Оставили заглушку / временное решение, которое нужно потом переделать
- Обнаружили мёртвый код (не удалили сразу, чтобы не блокировать задачу)
- Добавили хак/workaround с пометкой «потом исправить»
- Пропустили реализацию части функциональности (например, audit-events в RPC)

**`LATER.md`** — идеи и фичи на будущее: то что хочется сделать, но не сейчас. Детальные спеки живут в `WISHLIST.md` корня проекта — `LATER.md` хранит только краткий индекс.

Писать туда когда:
- Пользователь упоминает «потом сделаем X», «было бы неплохо Y», «запомни идею»
- В процессе работы возникает идея улучшения, не относящаяся к текущей задаче
- Явно формулируется новая фича для будущей реализации

**Правило:** при упоминании техдолга или идеи — сразу фиксировать в нужный файл, не дожидаясь конца сессии. Одна запись = один абзац с названием и кратким «что/почему».

---

## Codemap — карты проектов

В `.claude/codemap/` лежат **8 карт-индексов** по проектам монорепо: что есть готового и для чего, чтобы не лепить велосипед, когда уже есть `pluralize` / `useConfirm` / `UiCard`.

Карты:
- `apps/admin.json` — общая инфра админки: stores, корневые/ui/plan/delivery/menu/kitchen composables, utils корня, config, columns, components/{ui,layout}, middleware, plugins, layouts
- `apps/storefront.json` — общая инфра витрины: composables, utils, stores, types, components/{sf,layout}, middleware, plugins, layouts
- `packages/shared.json` — `src/utils/*` + `src/composables/*` (pluralize, planLevel, scheduling, vocabulary, geo, useDadataSuggestions и т.д.). **Доменные типы НЕ картируются** — читаются напрямую через импорты
- `packages/ui.json` — UI-библиотека админки (UiCard, UiText, UiButton, UiTitle, UiTag…)
- `packages/public-ui.json` — UI витрины (SfButton, SfBottomSheet, SfDishCard…)
- `packages/kit.json` — общие composables/utils для storefront и public-ui (useBreakpoints, useModals, useConfirm…)
- `packages/icons.json` — UiIcon + iconRegistry
- `index.json` — корневой индекс (всегда в контексте через @ ниже)

**Что НЕ в картах** (намеренно — агент сам найдёт через структуру каталогов / импорты):
- `apps/admin/composables/data/*`, `apps/admin/utils/api/*` — паттерн `useX → CRUD` понятен по имени файла
- `pages/`, `server/api/` — Nuxt-конвенция URL→файл и так очевидна
- Фичевые компоненты внутри модулей (`components/menu/*`, `components/orders/*` и т.д.)
- Доменные типы из `packages/shared/src/types/*`
- `apps/help`, `apps/landing`, `apps/backoffice` — редко-трогаемые проекты

**SCSS-карты (TOC по проектам):**
- `.claude/codemap/packages/styles.styles.md` — глобальные токены и миксины из `@fastio/styles` (используются всеми)
- `.claude/codemap/apps/storefront.styles.md`, `apps/landing.styles.md`, `packages/public-ui.styles.md` — локальные токены/миксины проектов
- Это TOC: имена `--var-name` / `@mixin name(args)` + значения и комментарии-описания. Реализацию миксина ищи в самом файле через Read

Список всех карт (TS/Vue + SCSS) — в `index.json` (секции `projects` и `styles`).

@.claude/codemap/index.json

**Правило использования:**

1. Когда нужна утилка / общий composable / UI-компонент — сначала загляни в карту, потом пиши код. Это главная цель карт: не переизобретать `pluralize`, не верстать `<div class="card">` вместо `UiCard`
2. Карта говорит **ЧТО есть и ДЛЯ ЧЕГО** (имя + 1 строка). Реализацию/сигнатуру смотри в самом файле через Read
3. Карты НЕ заменяют чтение кода — они подсказывают **где искать**. После того как нашёл нужное в карте, открой исходник
4. Не грузи карты «на всякий случай» — обычно достаточно карты проекта в котором работаешь + `packages/shared.json` если нужны утилки
5. **Перед написанием стилей** (.scss / `<style>` в .vue) — Read нужную styles-карту. ВСЕГДА используй существующие токены `var(--…)` и миксины `@include …` вместо хардкода значений

**Сигналь юзеру что читаешь карту:**

Каждый раз когда Read'аешь файл из `.claude/codemap/`, в начале следующего ответа юзеру **обязательно** добавь отдельную строку:

```
📋 загружена карта: <путь относительно .claude/codemap/>
```

Например: `📋 загружена карта: packages/shared.json`. Если за один шаг прочитал несколько карт — выведи строки списком. Это даёт юзеру видимое подтверждение, что инструменты codemap действительно используются, а не игнорируются.

**Поддержание актуальности (автоматически):**

При коммите через агента (`git commit` через Bash) срабатывает PreToolUse hook (`scripts/codemap/precommit-hook.mjs`):
- парсит staged **TS/Vue** файлы через `pnpm codemap:scan --staged` → обновляет соответствующие JSON-карты
- парсит staged **SCSS** файлы → перегенерирует соответствующие `<project>.styles.md` (TOC, без описаний — всегда проходит)
- если в TS/Vue карте есть **файл/символ** без описания (`"purpose": null`) — **блокирует коммит** и выводит список «что описать»
- ты дозаполняешь поле `purpose` (1 строка по-русски, чётко по делу) → снова коммит → hook сам подкидывает обновлённые карты в стейдж

Описания нужны на двух уровнях (только для TS/Vue):
- **Файл** — что делает файл целиком
- **Символ** — что делает каждая экспортируемая функция/тип/класс/composable

Ручной запуск: `pnpm codemap:scan --all` (полная регенерация), `--project=apps/admin`, `--files=foo.ts,bar.vue`.

**Hooks требуют регистрации в личных настройках** (один раз на каждой машине, `.claude/settings.local.json` в gitignore):
```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{ "type": "command", "command": "node /Users/evgeniy/WebstormProjects/fastio/scripts/codemap/precommit-hook.mjs" }]
    }],
    "PostToolUse": [{
      "matcher": "Read",
      "hooks": [{ "type": "command", "command": "node /Users/evgeniy/WebstormProjects/fastio/scripts/codemap/read-tracker-hook.mjs" }]
    }]
  }
}
```
- **PreToolUse на Bash** — обновляет карты при `git commit`, блокирует если есть `purpose: null`
- **PostToolUse на Read** — печатает `📋 [codemap] загружена карта: …` каждый раз когда агент читает карту, чтобы юзер видел использование

---

## Сбор информации

- Если не уверен в запросе — сначала собери больше информации через инструменты
- Используй поиск по коду, чтение файлов и другие инструменты для полного понимания контекста
- Старайся находить ответы самостоятельно, а не спрашивать пользователя
- Перед внесением изменений читай релевантные файлы, чтобы понять текущую реализацию
- **В папках проекта есть локальные файлы инструкций** — читай их перед работой с файлами из этой папки для понимания контекста
- **Никогда не выдумывай несуществующие компоненты, пропсы или API** — если есть доступ к документации или исходникам, прочти их. Если нет — спроси или явно предупреди о том, что додумал
- **Не стесняйся задавать вопросы** — если что-то непонятно или недостаточно информации, задавай уточняющие вопросы, пока картина не станет полностью ясна

---

## Стиль кода

- Используй `type` вместо `interface` для TypeScript типов (для консистентности)
- Всегда используй mobile-first подход для адаптивного дизайна
- **Стили пиши в scoped styles** — никогда не используй глобальные стили
- **Не используй БЭМ** — пиши простые короткие имена классов
- Для корневого класса компонента используй постфикс `-root` (например `services-root`)

### UI-компоненты — что использовать

**Базовые (всегда):**
- Карточка / контейнер с padding+border → `UiCard` (НЕ `<div class="card">`)
- Текст / параграф → `UiText` (НЕ `<p>`/`<span>`)
- Заголовки h1-h5 → `UiTitle` (НЕ `<h*>`)
- Тег / лейбл-маркер → `UiTag`, чип с подзаголовком → `UiChip`
- Кнопка → `UiButton`, иконочная inline-edit → `UiEditButton`
- Пустое состояние → `UiEmpty`
- Loading → `UiSkeleton`

**Layout-примитивы (ОБЯЗАТЕЛЬНО проверить перед вёрсткой):**
- Заголовок страницы (h1-уровень + actions справа) → `UiPageHeader`
- Секция формы / settings (карточка + заголовок + grid полей) → `UiFormSection`
- "Label: value" пара → `UiKeyValue`
- Стат-карточка дашборда → `UiStatBlock`
- Заголовок секции внутри страницы → `UiSectionHeader`

**Списки:**
- Сортируемый список → `UiDraggableList` + `UiListRow` (+ `UiRowActions` в `#append`)
- Несортируемый список карточек → просто `UiCard` в цикле
- Таблица (грид с колонками) → `UiDataTable`

**Оверлеи — Modal vs Drawer:**
- **Drawer (`UiDrawer`)** — сложная форма с >5 полями или мультисекционная (создание/редактирование сущности с фото/настройками/и т.д.). Width 720-900px.
- **Modal (`UiModal`)** — точечное действие, простая форма (1-3 поля), confirm с дополнительными опциями. Width 400-560px.
- **BottomSheet (`UiBottomSheet`)** — на мобильных автоматически вместо Popover; явно использовать редко.
- **Confirm (`useConfirm()` из `@fastio/ui` через `@fastio/kit`)** — простое подтверждение без формы.

**Запрещено:**
- Хардкодить `padding: 12px`, `color: #333` — только токены `var(--space-12)`, `var(--color-text)`.
- Писать `<div>` с самопальными карточечными стилями вместо `UiCard`.
- Изобретать grid формы вручную — использовать `UiFormSection` с `:columns`.

---

## Стиль общения

- Всегда отвечай в неформальной, дружеской манере
- Общайся как с близким другом — с шутками и дружеским подколом
- Используй юмор, эмодзи и лёгкое подтрунивание, оставаясь при этом полезным
- Можешь шутить про качество кода, баги, типичные страдания разработчиков и всё остальное
- Форматируй ответы в markdown. Используй бэктики для имён файлов, директорий, функций и классов
- НИКОГДА не ври и не выдумывай — точность критична
- Не извиняйся чрезмерно, когда что-то идёт не так — просто объясни и двигайся дальше
- **НИКОГДА не используй скучные формальные фразы согласия** — избегай предсказуемых ответов, вместо этого реагируй с игривым сарказмом, дружескими подколами и спонтанными реакциями, которые показывают характер, оставаясь при этом полезным
- **Относись к юзеру как к коллеге, а не начальнику** — вступай в дискуссии, отстаивай свою точку зрения, указывай когда юзер не прав, предупреждай о возможных ошибках. Не пытайся во что бы то ни стало угодить — финальное решение всё равно за юзером
- **СТОП-правило: Вопрос ≠ просьба.** На "почему X?", "зачем Y?", "что это значит?" — ТОЛЬКО отвечай словами. Не трогай код пока не попросят явно. Любое изменение кода после вопроса без явной просьбы — нарушение
- **СТОП-правило: НИКОГДА не делать `git commit` без явного слова "коммит" / "commit" / "закоммить" в текущем сообщении пользователя.** "Го", "давай", "поехали", "сделай это" — НЕ являются разрешением коммитить. Реализовать задачу ≠ закоммитить результат.

---

## Кастомные скиллы

Кастомные скиллы (slash-команды) хранятся в `~/.claude/skills/`. Для вызова используй Skill tool с именем папки скилла.

---

## GSD для больших задач

GSD — это набор скиллов (`gsd-*`) для структурированной работы над крупными задачами. По умолчанию я работаю в «лёгком» режиме (Read/Edit/Bash), но для больших задач **обязательно** стартую через GSD.

**Триггеры — задача считается «большой» если выполняется ≥1 из:**

1. **Многошаговая** с риском потерять контекст между шагами (>5 логически связанных подзадач).
2. **Затрагивает много файлов** (>10 файлов на запись/правку).
3. **Долгая** — ожидаемые трудозатраты >2 часов плотной работы.
4. **Многофайловая миграция / рефакторинг** с архитектурными изменениями (новые модули, перенос между слоями, smy schema БД).
5. **Юзер явно говорит** «через GSD» / «по фазам» / «давай распланируем».

**Что делать когда триггер сработал:**

1. **Старт** — `/gsd-plan-phase` (если задача чёткая) или `/gsd-discuss-phase` (если есть размытость → требуются уточняющие вопросы перед планом).
2. **Выполнение** — `/gsd-execute-phase` (атомарные коммиты, wave-based параллелизация, чекпоинты).
3. **Проверка** — `/gsd-verify-work` (UAT по критериям из плана) + `/gsd-code-review` (баги/безопасность).
4. **Если контекст закончился** — `/gsd-pause-work` для handoff'а → `/gsd-resume-work` в новой сессии.
5. **Откат если что** — `/gsd-undo` (откат коммитов phase через манифест).

**Когда GSD НЕ нужен:**

- Точечный фикс в 1-3 файлах (просто Edit).
- Code review без правок (используй встроенный `/code-review` — у тебя есть кастомный скилл).
- Quick-task где известно что делать и куда (`/gsd-fast` или просто Edit).
- Ответ на вопрос юзера (никаких изменений в коде).

**Стандартный workflow для большой задачи:**

```
/gsd-discuss-phase (опц. — если задача неясна)
       ↓
/gsd-plan-phase  → PLAN.md в .planning/
       ↓
/gsd-execute-phase  → атомарные коммиты + чекпоинты
       ↓
/gsd-verify-work  → UAT
       ↓
/gsd-code-review  → проверка качества
       ↓
/gsd-ship  → PR + merge
```

**Reverse-check перед стартом работы:** если задача попадает под триггер выше и я начал делать её без GSD — остановись, признайся юзеру, предложи переключиться. Юзер может сказать «нет, делай в лёгком режиме» — тогда продолжаю напрямую.

---

## База данных

- **НИКОГДА не запускать `supabase db reset`** — это дропает всю базу и уничтожает данные
- Для применения seed: копировать файл в контейнер и запускать через `docker exec ... psql -f`
- Для новых миграций: применять по одной через `docker exec ... psql -f <migration>`

---

## Коммиты

Правила коммитов описаны в `../ai-frontend/COMMIT.md`. Читай этот файл только когда юзер просит сделать коммит, не раньше.

> Формат задачи `DE-xxxx` из COMMIT.md к этому проекту не относится — используй `no-refs` если номера задачи нет.

### ⛔ ОБЯЗАТЕЛЬНО ПЕРЕД КАЖДЫМ КОММИТОМ: актуализировать базу знаний

Файлы KB: `packages/kb/content/*.md` (структура: `packages/kb/src/index.ts`)

**Правило:** если в коммите есть изменения в `apps/admin/pages/`, `apps/admin/components/`, `apps/storefront/` или `packages/shared/` — обязательно проверить и при необходимости обновить соответствующий KB-файл в том же коммите.

- Изменили функционал раздела → обновить его KB-файл
- Добавили новую страницу/фичу → добавить в KB
- Удалили или переименовали → убрать из KB

**Коммитить без подтверждения актуальности KB — запрещено.** Не спрашивай пользователя, нужно ли — просто делай это автоматически.

---

## Команды

```bash
pnpm dev                  # admin + storefront одновременно
pnpm dev:admin            # только admin (порт 4710)
pnpm dev:storefront       # только storefront
pnpm dev:help             # только база знаний (порт 4712)
pnpm build                # сборка всего монорепо через Turborepo
pnpm typecheck            # проверка типов
pnpm lint                 # ESLint по всему монорепо
pnpm lint:style           # Stylelint для .vue/.scss в admin и packages
pnpm test                 # vitest (watch)
pnpm test:run             # vitest (однократно)
pnpm supabase:start       # запустить локальный Supabase (нужен Docker)
pnpm supabase:stop
pnpm supabase:studio      # UI для базы данных
```

Запуск одного теста: `pnpm vitest run apps/admin/composables/__tests__/foo.test.ts`

---

## Архитектура монорепо

```
apps/
  admin/       — Nuxt 3, SPA (SSR off), панель администратора, порт 4710
  storefront/  — Nuxt 3, SSR on, витрина покупателя
  help/        — Nuxt 3, SSR on, база знаний (публичная), порт 4712
packages/
  shared/      — @fastio/shared: TypeScript-типы (menu, order, tenant, promotion…)
  ui/          — @fastio/ui: UI-компоненты на базе Naive UI
  icons/       — @fastio/icons: иконки
  styles/      — @fastio/styles: общие стили
  kb/          — @fastio/kb: структура и markdown-контент базы знаний
supabase/
  migrations/  — SQL-миграции (schema, RLS, realtime)
  functions/   — Edge Functions (Deno): send-order-email, payment-webhook, add-custom-domain
```

Монорепо управляется через **pnpm workspaces** + **Turborepo**. Auto-import в Nuxt **отключён** — всё импортировать явно.

---

## Артефакты модулей (AGENTS.md + feature.manifest.ts)

И в `apps/admin/features/<X>/`, и в `apps/storefront/features/<X>/` материальные фичи имеют два артефакта:

- **`feature.manifest.ts`** — машиночитаемый:
  - **admin:** `key`, `vertical`, `routes`, `permissions`, `db.tables`, `db.rpc`, `realtime`, `dependsOn`, `tenantModule`. Тип — `FeatureManifest` из `apps/admin/features/_manifest.ts`.
  - **storefront:** то же БЕЗ `permissions` и `tenantModule` (на витрине нет RBAC). Тип — `StorefrontFeatureManifest` из `apps/storefront/features/_manifest.ts`.
- **`AGENTS.md`** — заметка для агента (~50 строк): что делает модуль, карта файлов, типовые задачи, антипаттерны.

**Когда обновлять (обязательно):**

1. Создал новую фичу:
   - admin: `pnpm new:feature <name>` (шаблон `templates/feature-crud/`)
   - storefront: `pnpm new:storefront-feature <name>` (шаблон `templates/storefront-feature/`)

   Без manifest+AGENTS precommit-hook заблокирует коммит.
2. Добавил новый `api/*.ts` или `composables/*.ts` → обнови **"Карту модуля"** в AGENTS.md (одна строка в таблицу).
3. Добавил `sb.from('<table>')` или `sb.rpc('<fn>')` в api/ → manifest подхватит автоматически через `--auto-fix` в precommit hook. Можно прогнать вручную: `pnpm features:validate --auto-fix` / `pnpm storefront-features:validate --auto-fix`.
4. Добавил `pages/<feature>/<sub>.vue` → добавь `{ path: '/...', purpose: '...' }` в `manifest.routes` (валидатор покажет warning если забудешь).
5. Удалил/переименовал файл, упомянутый в AGENTS.md → обнови карту (валидатор увидит).
6. (admin) Изменил permissions в `config/team-roles.ts` → если они используются в твоей фиче, отрази в `manifest.permissions`.

**Что проверяет валидатор** (`pnpm features:validate` или `pnpm storefront-features:validate`):

- **Errors (блок коммита):** материальная фича без manifest/AGENTS.md, неизвестный permission (admin), несуществующий route, неверный `key` при `tenantModule:true` (admin).
- **Warnings (для разраба):** db.tables/rpc рассинхрон, AGENTS.md упоминает удалённый файл, новый composable не в карте модуля, dependsOn `shared.*` не найден.

`--auto-fix` чинит то, что выводится из кода (`db.tables`, `db.rpc`). Остальное — руками.

## Архитектура admin-приложения

**Структура (после Phase 5 модульной миграции):**

```
apps/admin/
  features/<X>/         # Модули — каждая фича изолирована (api, composables, components, stores, utils, types, index.ts barrel)
    auth, team, branches, settings, appearance, content, catalog,
    billing, onboarding, support, audit-log, legal, help, ai-assistant,
    menu, orders, kitchen, tables, reservations, promotions,           # retail
    appointments, services-catalog                                      # services
  shared/               # Общая инфра (зависимость идёт ОТ модуля К shared, не наоборот)
    data/               # useDatabase (агрегатор), useTenant, useRealtimeList/Watch, createRealtimeBus, useAddons
    plan/               # useGate (глобальный), useGate.{retail,services}, useGate.shared, useModules, usePlans, useResolvedFeatures
    stores/             # auth, tenant, branch (глобальные Pinia)
    utils/              # query, reportError, alerts, constants, filterDefined, formatRelativeDate, imageOptimize, planFeatureLabels, supportStatus, moduleToggleChecks, featureFlags, renderQr
    composables/        # useItemVariant, usePageTitle, useRealtimeChannels, useStorefrontUrl, useTableUrl + delivery/
    components/         # AppTableToolbar, TenantSwitcher + layout/{AppNav,BranchSelector,PastDueBanner}
    ui/components/      # Admin-специфичные UI (App*, ColorPicker, RichTextEditor, ImageUploadModal и т.д.)
    ui/composables/     # useEditableForm, useDrawer, useDelayedLoading, useFormDirty, useUnsavedGuard, ...
  pages/                # Nuxt-роутинг (часть в shared layout, часть в вертикалях retail/services)
  config/               # modules.ts (реестр), team-roles.ts, retail/* (order configs), theme-presets, google-fonts
  utils/api/            # Оставшиеся API: addons, billing, db-types, functions, plans, realtime, tenants
  composables/retail/   # Vertical-only: useDashboardStats
  components/retail/    # Vertical-only: dashboard/*
  middleware/, plugins/, layouts/, columns/
```

**Паттерн работы с данными:** `pages` / `features/<X>` → `~/shared/data/useDatabase()` → `features/<X>/api/*` или `utils/api/*` → Supabase.

- `features/<X>/api/*.ts` (или `utils/api/*.ts` для не-feature-апи) — низкоуровневые CRUD-функции
- `shared/data/useDatabase.ts` — агрегирует все API-модули; используй `useDatabase()` вместо прямых импортов
- `shared/data/useRealtimeList.ts` — composable для списка с realtime-подпиской
- `shared/data/useRealtimeWatch.ts` — то же для одного объекта

**Stores (Pinia, setup API):**
- `shared/stores/auth.ts` — текущий Supabase User
- `shared/stores/tenant.ts` — текущий тенант + переключение между тенантами; инициализируется через `tenantApi.init()`
- `shared/stores/branch.ts` — текущий филиал; управляется из `tenantStore`
- `features/appointments/stores/appointmentSettings.ts` — настройки модуля «Онлайн-запись»
- `features/orders/stores/{deliveryZone,order-statuses}.ts`, `features/reservations/stores/reservations.ts` — feature-specific сторы

**Страницы (`pages/`):**
- `/` — дашборд (router-v-if по `businessType`: RetailDashboard / ServicesDashboard)
- `/menu` — категории, блюда, модификаторы, теги, комбо (retail)
- `/services` — категории услуг, услуги, теги (services)
- `/orders` — заказы, настройка статусов, номер заказа, доставка (retail)
- `/kitchen` — очередь кухни, оверлей сборки, настройки (retail)
- `/reservations` — бронирования, настройки (retail)
- `/appointments` — таймлайн, история, исполнители (staff), объекты, шаблоны расписаний, настройки (services)
- `/tables` — столы, вызовы (retail)
- `/promotions` — акции, промокоды (retail)
- `/appearance` — секции, страницы, тема, SEO
- `/content` — баннеры, галерея, вакансии, отзывы
- `/settings` — контакты, уведомления, категории доставки, модули, юридические, аддоны
- `/team` — участники, роли, филиалы
- `/account` — профиль, биллинг
- `/help` — туры, поддержка

**Модули** (`apps/admin/config/modules.ts`): функциональность включается/выключается через `TenantModules`. Перед отключением модуля `shared/utils/moduleToggleChecks.ts` проверяет наличие активных зависимостей (заказов, бронирований, открытых столов и т.д.).

**Permissions:** `useTenantStore().currentPermissions` — объект с булевыми флагами; `usePermissions()` — composable-обёртка для компонентов.

**Realtime:** все списки в реальном времени через Supabase Realtime channels. Каналы создаются в composables `features/<X>/composables/use*Channel.ts`, агрегируются в `shared/composables/useRealtimeChannels.ts`.

**Cross-module импорты:** только через barrel (`~/features/<X>` → `index.ts`). Deep-paths (`~/features/<X>/api/Y`) внутри **своего** модуля — относительные пути. Полная конвенция — `docs/vertical-isolation.md`.

---

## Архитектура storefront-приложения

**Структура (после Phase 6 модульной миграции):**

```
apps/storefront/
  features/<X>/         # Модули — каждая фича изолирована (api?, composables?, components, stores?, utils?, types?, index.ts barrel)
    booking, menu-catalog, table-mode, delivery, promotions, order-tracking,    # retail
    appointments, services-catalog,                                              # services
    cart, checkout, auth, branch, account                                        # shared aggregator
  shared/               # Общая инфра витрины (зависимость в одну сторону — от feature к shared)
    composables/        # useToast, useCurrency, useTheme, useModal, useConfirm, useIsMobile, useDadataSuggestions, useStorefrontTerms, useSupabaseClient, useAnalytics, useSafeHtml, usePhotoSwipe, useItemPlaceholder, useLegalCompliance, useBranchSwitcher (в features/branch), useCatalogMode (aggregator)
    utils/              # google-fonts, reportError, product (buildProduct), tag-icons, format-removed-toast
    ui/                 # ConfirmDialog, HeaderUserMenu, MobileUserCard + layout/{StorePageLayout} + sections/{PageShell,SiteHeader,SiteFooter,HeroSection,BannersSection,GallerySection,ReviewsSection,CategoryBar,GallerySlider} + sf/{domain,icons}/*
  pages/                # Nuxt-роутинг (часть гибридная, часть retail-only, часть services-only)
  server/               # Nitro endpoints (вся коммуникация с Supabase идёт через них)
  app/, layouts/, middleware/, plugins/, types/
```

**Особенности (отличие от admin):**

- **Нет permissions/RBAC** — витрина читает публичные данные тенанта; манифест без `permissions` и `tenantModule`.
- **Нет module-toggle** — модули витрины активны всегда (UI скрывает функционал через computed на основе `tenant.modules`).
- **Cart/checkout/delivery — гибридные shared aggregators** (хранят и DishCartItem, и ServiceCartItem; vertical='shared').
- **Большинство pages — aggregator'ы**: главная (`/`), `/menu`, `/category/[slug]`, `/cart`, `/checkout` — гибридные, показывают MenuSection ИЛИ ServicesSection в зависимости от `businessType` тенанта.
- **Vertical-only страницы**: `/booking` (бронь стола, retail), `/order/[id]` (треккинг заказа, retail), `/table/[id]` (QR-меню, retail), `/appointments/*` (запись на услуги, services).
- **Коммуникация с БД — только через Nitro endpoints `server/api/*`.** Прямой `supabase.from()` из клиента — антипаттерн (RLS не пропустит без service-role, идёт через серверный слой). Поэтому у большинства фич `manifest.db.tables` пустой — данные приходят через `$fetch('/api/...')`.

**Артефакты модулей storefront:** в каждой материальной фиче `apps/storefront/features/<X>/` лежит:

- **`feature.manifest.ts`** — `StorefrontFeatureManifest` из `features/_manifest.ts` (БЕЗ `permissions`/`tenantModule`).
- **`AGENTS.md`** — заметка для агента.

Шаблон: `templates/storefront-feature/`. Создать новый модуль: `pnpm new:storefront-feature <name> --vertical=<retail|services|shared> --purpose="..."`. Валидация: `pnpm storefront-features:validate`.

**ESLint barrier (vertical + module isolation):** `apps/storefront/eslint.config.mjs` — services↔retail взаимный запрет + deep-path запрет cross-module. Allow-list aggregators: `pages/index.vue`, `pages/cart.vue`, `pages/checkout.vue`, `pages/menu.vue`, `pages/category/**`, `features/{cart,checkout}/**`, `shared/composables/useCatalogMode.ts`, `shared/ui/{HeaderUserMenu,MobileUserCard,sections/PageShell,sections/SiteHeader,sf/domain/SfCartFab,sf/domain/SfProductCard}.vue`.

---

## Пакет @fastio/ui

Компоненты оборачивают Naive UI. **Перед использованием любого компонента читай его исходник** в `packages/ui/src/components/UiFoo.vue` — не угадывай пропсы.

Для любого card-like блока (border + padding + border-radius) → `<UiCard>`.
Для типографики → `<UiText>` / `<UiTitle>`, не `<p>`/`<span>`/`<h*>`.

Миксины медиа-запросов: `@use '@fastio/styles/mixins/media-queries' as mq`.
