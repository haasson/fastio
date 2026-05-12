# onboarding — заметка для агента

Wizard первичной настройки (shared). Полная мета — `feature.manifest.ts`.

## Что модуль делает

Серия шагов после создания тенанта: «настройте филиал», «добавьте блюдо/услугу», «пригласите команду» и т.п. Состояние хранится в `tenants.onboarding_state` (jsonb) — какие шаги пройдены/пропущены. UI — overlay/wizard поверх обычных страниц.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `config/onboarding.ts` | Конфиг шагов: id, условие отображения, целевой URL, текст |
| `composables/useOnboarding.ts` | Состояние wizard'а: текущий шаг, доступные, завершённые |
| `composables/useOnboardingActions.ts` | Действия: `complete(stepId)`, `skip(stepId)`, `dismiss()` — мутируют `tenants.onboarding_state` |
| `components/*` | Wizard-оверлей, карточки шагов, prompts. Импорт deep-path |

## Типовые задачи

- **Новый шаг:** добавь в `config/onboarding.ts` (id + when + label + targetRoute) + если нужна не-стандартная логика «выполнено» — добавь в `useOnboarding.isStepDone()`.
- **Условный шаг (только для services):** в `when:` обращайся к `tenantStore.businessType` или `tenantStore.modules.<key>`.
- **Триггер контекстной подсказки:** в `pages/<X>.vue` дёрни `useOnboardingActions().promptIfPending('step-id')`.

## Антипаттерны (не делай так)

- ❌ Создавать отдельную таблицу `onboarding_steps` — `tenants.onboarding_state` хватает для всех тенантов.
- ❌ Хардкодить «текст подсказки» в компоненте — клади в `config/onboarding.ts`, иначе будет рассинхрон между шагами.
- ❌ Маркировать шаг «выполнен» из самого шага — это делает `useOnboardingActions.complete()` после реального события (создание блюда, инвайт и т.п.).

## Куда расти

Локализация шагов — пока ru-only. Если будет — выноси тексты в `@fastio/shared/i18n`, не размазывай по `config/onboarding.ts`.
