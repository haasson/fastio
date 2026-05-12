# menu-catalog — заметка для агента

Каталог блюд для общепита (retail). Не путать с `services-catalog` (каталог услуг) или `cart` (общая корзина с блюдами + услугами).

## Что модуль делает

Хранит меню тенанта (`dishes`, `categories`, `combos`, `addons`) в Pinia-сторе, отдаёт через `useMenuStore`. Меню грузится через `/api/menu` один раз и потом сидит в памяти (SSR-hydrated).

`useDishCustomization` — фабрика state'а для модалки блюда: выбор модификаторов, аддонов, удаление ингредиентов из комбо. Принимает `ModalItem` (блюдо/комбо/уже-в-корзине-item), возвращает реактивный state с подсчётом цены.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `stores/menu.ts` | `useMenuStore` — все dishes/categories/combos/addons тенанта + computed lookups (`dishById`, `comboById`, `dishesByCategory`). `ClientAddon` тип. |
| `composables/useDishCustomization.ts` | Фабрика state'а модалки кастомизации: модификаторы, аддоны, удалённые ингредиенты. Типы `ModalItem`, `ComboItemInfo`. |
| `components/MenuSection.vue` | Главная секция витрины: сетка блюд по категориям + категориальная панель. Открывает `DishModal`. |
| `components/DishModal.vue` | Десктоп-модалка блюда (FsDialog). Использует `DishCustomization` body + `DishModalFooter`. |
| `components/DishModalBody.vue` | Альтернативная встроенная вёрстка тела модалки (используется на cart-странице для редактирования item в drawer). |
| `components/DishCustomization.vue` | Сама вёрстка кастомизации: чипы модификаторов, аддонов, ингредиенты. |
| `components/DishNutrition.vue` | Блок «БЖУ/калории» внутри модалки. |
| `components/DishModalFooter.vue` | Кнопки «Добавить» / «Сохранить» + цена + qty-counter в подвале модалки. |
| `__tests__/useDishCustomization.test.ts` | Юнит-тесты на расчёт цены и валидацию модификаторов. |

## Типовые задачи

- **Новое поле блюда:** миграция → тип `Dish` в `packages/shared/src/types/menu.ts` → `mapDish` на бэке (`server/utils/db-mappers.ts`) → `useMenuStore` (если нужно computed) → UI в `MenuSection`/`DishModal`.
- **Новая логика модификаторов:** правь `useDishCustomization` + тесты в `__tests__/useDishCustomization.test.ts`. Логика расчёта цены — в `@fastio/shared` (`getItemUnitPrice`), не дублируй.
- **Новый компонент модалки:** клади в `components/` рядом, импортируй через `./Name.vue` (relative).

## Антипаттерны (не делай так)

- ❌ Прямой `supabase.from('dishes').select()` в client — RLS ленивая, используй `/api/menu`.
- ❌ Импорт `~/features/menu-catalog/stores/menu` снаружи модуля — через `~/features/menu-catalog` (barrel).
- ❌ Vue компоненты deep-path — допускается. То есть `~/features/menu-catalog/components/DishModal.vue` — норма (из cart, например).
- ❌ Дублировать логику цены в компоненте — в `@fastio/shared/getItemUnitPrice` уже есть.
- ❌ Хранить состояние «открыта ли модалка» в menu-store — это локальный state страницы/секции.

## Куда расти

- **Реактивные цены в корзине** (WISHLIST): cart хранит snapshot, надо обогащать через `useMenuStore`.
- **Импорт меню из CSV** (WISHLIST): новая страница в админке + bulk-insert в `/api/menu` (не в storefront).
- **Custom dish tags** (уже реализовано): сейчас в `Dish.tags`. Если расширять — миграция + тип.
