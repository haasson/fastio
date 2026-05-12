# catalog — заметка для агента

Универсальный каталог (shared). Полная мета — `feature.manifest.ts`.

## Что модуль делает

Общая инфраструктура для двух «каталогов» — `menu` (блюда) и `services-catalog` (услуги): теги и категории — концепт один. Здесь живут:
- API тегов (`dish_tags` + assignments)
- composables списка категорий/тегов
- **cross-vertical UI-компоненты:** `ItemCard`, `BasicInfoSection`, `TagsSection` — реэкспортируются из barrel, используются и в `menu`, и в `services-catalog`.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/tags.ts` | CRUD тегов (`dish_tags`) + assign/unassign к dishes/combos |
| `composables/useCategories.ts` | Общий composable категорий (унифицированный для menu и services) |
| `composables/useTags.ts` | Realtime-список тегов |
| `composables/useTagDisplay.ts` | Утилка форматирования тега (цвет, иконка) |
| `components/ItemCard.vue` | **Cross-module:** карточка предмета каталога (dish или service). Реэкспортится |
| `components/form/BasicInfoSection.vue` | **Cross-module:** секция формы name/description/image |
| `components/form/TagsSection.vue` | **Cross-module:** секция формы тегов |

## Типовые задачи

- **Новое cross-vertical поле в форме (например, video):** компонент в `components/form/` + реэкспорт в barrel. Не дублируй между menu/services.
- **Новый тег-тип (allergen, badge и т.п.):** расширь enum в `dish_tags.kind` + миграция. UI: `useTagDisplay` подхватит автоматически если есть в маппинге.
- **Связь категорий между menu и services:** `categories` — это одна таблица в БД (наследуется через `business_type` фильтр). Логика — `useCategories`.

## Антипаттерны (не делай так)

- ❌ Создавать `service_tags` отдельно — теги общие.
- ❌ Дублировать `ItemCard` для menu и services — он один тут.
- ❌ Класть бизнес-логику menu/services сюда — здесь только **универсальный** общий слой.
- ❌ Создавать отсюда зависимости на `features/menu` или `features/services-catalog` — это catalog (низший уровень), не должен знать о потребителях.

## Куда расти

Если каталогов станет три (например, добавится `events` или `merch`) — этот модуль уже подготовлен. Просто новый `features/<X>` будет использовать `ItemCard`/`useCategories`.
