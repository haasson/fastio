# appearance — заметка для агента

Внешний вид витрины (shared). Полная мета — `feature.manifest.ts`.

## Что модуль делает

Кастомизация витрины: тема (цвета, шрифты), порядок секций главной, кастомные страницы, SEO. **Своих таблиц у фичи нет** — всё хранится в `tenants.*` (jsonb-поля `theme`, `sections`, `pages`, `seo`), мутации идут через `useTenantStore().update()`.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `composables/useAppearanceForm.ts` | Универсальная форма редактирования с predictable optimistic + rollback |
| `components/*` | Редактор темы (ColorPicker-обёртки), редактор секций, превью. Cross-module — импорт deep-path |

## Типовые задачи

- **Новая секция витрины:** добавь enum в `TenantSection.type` + пресет в `useAppearanceForm` + компонент-превью + рендер на storefront. **Storefront знает о секциях из `tenants.sections`** — не дублируй структуру.
- **Новая настройка темы:** поле в `TenantTheme` тип (в `@fastio/shared/types/tenant`) + контрол в редакторе + поддержка в storefront CSS variables (`apps/storefront/composables/useThemeVars.ts`).
- **Кастомные страницы:** статичные .vue не подходят — это контент в `tenants.pages` (jsonb с rich-text). Storefront рендерит через generic page-component.

## Антипаттерны (не делай так)

- ❌ Создавать таблицы под темы/секции — лей в `tenants`. Один тенант = один набор настроек.
- ❌ Менять `tenants.theme` через `sb.from('tenants').update()` — иди через `tenantStore.update()`.
- ❌ Хардкодить fallback-значения CSS-переменных — design tokens обязательны (см. memory: feedback_no_css_fallbacks).
- ❌ Прибивать секции к conkretным URL-роутам — секции это **компоненты на главной**, а не страницы.

## Куда расти

Pre-built темы (preset gallery) — `apps/admin/config/theme-presets.ts` уже есть. Не создавай вторую систему.
