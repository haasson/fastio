# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# FastFood SaaS — Инструкции для AI

## TECHDEBT.md и LATER.md

Два файла в директории автопамяти (рядом с `MEMORY.md`):

- **`TECHDEBT.md`** — технический долг: заглушки, хаки, мёртвый код, временные решения.
- **`LATER.md`** — идеи на будущее (краткий индекс). Детальные спеки — в `WISHLIST.md` корня.

**Правило:** при упоминании техдолга или идеи — сразу фиксировать в нужный файл, не дожидаясь конца сессии. Одна запись = один абзац с названием и кратким «что/почему».

---

## Codemap — карты проектов

В `.claude/codemap/` лежат карты-индексы монорепо: что есть и для чего. Список карт (TS/Vue + SCSS) — в `.claude/codemap/index.json` (читать по требованию, не всегда).

**Правила:**
1. Нужна утилка / composable / UI-компонент — загляни в карту проекта, потом пиши код.
2. Карта говорит ЧТО есть и ДЛЯ ЧЕГО. Реализацию/сигнатуру — в исходнике через Read.
3. Перед стилями (.scss / `<style>`) — Read нужную styles-карту. Используй токены `var(--…)` и миксины вместо хардкода.
4. Не грузи карты «на всякий случай» — обычно достаточно карты нужного проекта + `packages/shared.json`.

**Сигналь:** каждый раз когда читаешь файл из `.claude/codemap/`, добавь строку `📋 загружена карта: <путь>`.

**Обновление:** при `git commit` срабатывает precommit hook — обновляет карты, блокирует если `purpose: null`. Ручной запуск: `pnpm codemap:scan --all`.

---

## Сбор информации

- Если не уверен — сначала собери информацию через инструменты, не спрашивай юзера
- Перед изменениями читай релевантные файлы
- **В папках фич есть AGENTS.md** — читай перед работой с модулем
- **Никогда не выдумывай несуществующие компоненты, пропсы или API** — читай исходник, или спроси

---

## Стиль кода

- `type` вместо `interface` для TypeScript типов
- Mobile-first адаптивный дизайн
- **Стили — только в scoped styles**, не глобальные
- **Без БЭМ** — простые короткие имена классов
- Корневой класс компонента — постфикс `-root`

### UI-компоненты — что использовать

**Базовые (всегда):**
- Карточка → `UiCard` (НЕ `<div class="card">`)
- Текст → `UiText` (НЕ `<p>`/`<span>`), Заголовки → `UiTitle` (НЕ `<h*>`)
- Тег → `UiTag`, чип → `UiChip`, кнопка → `UiButton`, inline-edit → `UiEditButton`
- Пустое состояние → `UiEmpty`, Loading → `UiSkeleton`

**Layout-примитивы (проверить перед вёрсткой):**
- Заголовок страницы → `UiPageHeader`
- Секция формы → `UiFormSection`, "Label: value" → `UiKeyValue`
- Стат-карточка → `UiStatBlock`, Заголовок секции → `UiSectionHeader`

**Списки:** сортируемый → `UiDraggableList` + `UiListRow`, таблица → `UiDataTable`

**Оверлеи:**
- `UiDrawer` — сложная форма >5 полей (720-900px)
- `UiModal` — точечное действие, 1-3 поля (400-560px)
- `useConfirm()` — простое подтверждение без формы

**Запрещено:** хардкодить `padding: 12px`, `color: #333` — только токены. `<div>` с самопальными карточечными стилями вместо `UiCard`. Grid формы вручную вместо `UiFormSection`.

---

## Стиль общения

- Неформально, дружески, с юмором и лёгким подколом
- Markdown + бэктики для кода/файлов/функций
- НИКОГДА не ври и не выдумывай — точность критична
- **Никогда не используй скучные формальные фразы согласия** — реагируй с характером и сарказмом
- **Относись к юзеру как к коллеге** — вступай в дискуссии, указывай когда не прав
- **СТОП: Вопрос ≠ просьба.** На "почему X?", "зачем Y?" — ТОЛЬКО отвечай словами. Не трогай код.
- **СТОП: НИКОГДА не делать `git commit` без явного слова "коммит"/"commit"/"закоммить".**

---

## Кастомные скиллы

Хранятся в `~/.claude/skills/`. Вызов — Skill tool с именем папки.

---

## GSD для больших задач

**Триггеры — задача считается «большой» если ≥1:**
1. >5 логически связанных подзадач
2. >10 файлов на запись/правку
3. >2 часов трудозатрат
4. Многофайловая миграция / архитектурные изменения
5. Юзер явно говорит «через GSD» / «по фазам»

**Workflow:** `/gsd-discuss-phase` (если неясно) → `/gsd-plan-phase` → `/gsd-execute-phase` → `/gsd-verify-work` + `/gsd-code-review` → `/gsd-ship`

**Когда НЕ нужен:** точечный фикс 1-3 файла, code review без правок, quick-task, ответ на вопрос.

**Reverse-check:** если задача под триггер и начал без GSD — остановись, признайся юзеру, предложи переключиться.

---

## База данных

- **НИКОГДА не запускать `supabase db reset`** — дропает всю базу
- Seed: копировать в контейнер + `docker exec ... psql -f`
- Миграции: по одной через `docker exec ... psql -f <migration>`

---

## Коммиты

Правила: `../ai-frontend/COMMIT.md` (читай только когда юзер просит коммит). Нет номера задачи → `no-refs`.

### ⛔ Перед каждым коммитом: актуализировать KB

Файлы: `packages/kb/content/*.md`

Если в коммите изменения в `apps/admin/pages/`, `apps/admin/components/`, `apps/storefront/` или `packages/shared/` — обновить соответствующий KB-файл в том же коммите. **Делать автоматически, не спрашивать.**

---

## Команды

```bash
pnpm dev / dev:admin / dev:storefront / dev:help
pnpm build / typecheck / lint / lint:style / test / test:run
pnpm supabase:start / stop / studio
```

Порты: admin — 4710, help — 4712. Один тест: `pnpm vitest run <path>`.

---

## Архитектура монорепо

```
apps/admin/       — Nuxt 3, SPA (SSR off), порт 4710
apps/storefront/  — Nuxt 3, SSR on
apps/help/        — Nuxt 3, SSR on, порт 4712
packages/shared/  — @fastio/shared: TypeScript-типы
packages/ui/      — @fastio/ui: UI на базе Naive UI
packages/icons/   — @fastio/icons
packages/styles/  — @fastio/styles
packages/kb/      — @fastio/kb: база знаний
supabase/migrations/ / functions/
```

pnpm workspaces + Turborepo. Auto-import в Nuxt **отключён** — всё импортировать явно.

Детальная архитектура: [`docs/admin-arch.md`](docs/admin-arch.md), [`docs/storefront-arch.md`](docs/storefront-arch.md).

---

## Артефакты модулей (AGENTS.md + feature.manifest.ts)

В `features/<X>/` каждой материальной фичи — `feature.manifest.ts` + `AGENTS.md`. Без них precommit-hook блокирует коммит.

Детали (когда обновлять, что проверяет валидатор): [`docs/feature-manifests.md`](docs/feature-manifests.md).

---

## Пакет @fastio/ui

Компоненты оборачивают Naive UI. **Перед использованием читай исходник** `packages/ui/src/components/UiFoo.vue` — не угадывай пропсы.

Миксины: `@use '@fastio/styles/mixins/media-queries' as mq`.
