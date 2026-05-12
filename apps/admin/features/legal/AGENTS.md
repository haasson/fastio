# legal — заметка для агента

Юридические страницы FastIO (shared). Полная мета — `feature.manifest.ts`.

## Что модуль делает

Статические страницы оферты и политики FastIO (это юр.документы **самого SaaS**, не тенанта). Своих юр.документов тенанта (terms витрины) тут нет — они в `features/settings` (`/settings/legal`). Также `useTerms` отслеживает версию оферты и просит акцепт у пользователя при изменении.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `utils/fastio-legal.ts` | Версия документа + ссылки на актуальные тексты |
| `composables/useTerms.ts` | Проверка согласия (`tenants.legal_agreed_at` ≥ текущей версии) + триггер acceptance-модалки |
| `components/LegalDocPage.vue` | **Cross-module API:** реэкспортится из barrel. Используется в `pages/legal/*.vue` |

## Типовые задачи

- **Новая версия оферты:** обнови константу `OFFER_VERSION` в `utils/fastio-legal.ts` → все тенанты увидят acceptance-модалку при следующем заходе.
- **Новая страница (например, /legal/personal-data):** новый `pages/legal/<name>.vue` использует `LegalDocPage`.

## Антипаттерны (не делай так)

- ❌ Хардкодить версию документа в нескольких местах — она одна, в `fastio-legal.ts`.
- ❌ Класть сюда юр.документы тенанта (terms доставки, политику возврата) — это `features/settings` или `features/appearance`.

## Куда расти

Локализация документов — пока ru-only. Документы лежат как .md/.vue в `pages/legal/`, не в БД.
