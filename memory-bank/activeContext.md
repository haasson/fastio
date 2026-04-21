# Active Context: Fastio

## Current Work Focus
Разработка `apps/help` — публичной базы знаний с AI-ассистентом. Параллельно ведётся работа над storefront (галерея с PhotoSwipe, секции).

## Recent Changes
- Добавлен `apps/help/` — новое Nuxt SSR приложение (порт 4712)
- Добавлен `packages/kb/` — пакет с markdown-контентом и структурой KB
- В `apps/admin/server/ai/loadKnowledge.ts` — логика загрузки контента для AI-ассистента (загружает ai-knowledge и kb файлы, фильтрует по текущему роуту)
- `apps/admin/pages/help.vue` изменён — вероятно интеграция с AI
- Обновлена навигация admin (`AppNav.vue`, `default.vue`)
- PhotoSwipe lightbox добавлен в gallery slider (storefront)
- Исправлен порядок рендера секций storefront по `sectionsOrder`
- Пиннинг categoryBar и hero в sections editor

## Next Steps
- Уточнить у пользователя текущий статус help-приложения
- Обновить этот файл после прояснения задач

## Active Decisions and Considerations
- `@fastio/kb` — единый источник правды для контента KB: используется и в help-приложении (рендер страниц), и в admin (AI-ассистент загружает kb-файлы через `loadKnowledge`)
- KB_ROUTES в `packages/kb/src/index.ts` маппит роуты admin → секции AI-знаний

## Important Patterns and Preferences
- Пользователь предпочитает неформальное общение, юмор, конкретику
- Всегда читать исходники компонентов @fastio/ui перед использованием
- Перед коммитом — обновлять KB-файлы в `packages/kb/content/*.md`
