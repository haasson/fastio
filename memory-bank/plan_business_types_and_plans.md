# План: Типы бизнеса и тарифы

## Контекст

Проект — SaaS-платформа для создания сайтов с онлайн-заказами/записью. Монорепо: `apps/admin` (Nuxt SPA), `apps/storefront` (Nuxt SSR), `apps/landing` (лендинг), `apps/backoffice` (внутренний бэкофис), `packages/shared` (TypeScript типы).

Сейчас `businessType: 'food' | 'retail' | 'services'` влияет только на лейблы. Тарифы хранятся в таблице `plans` (ключи: `service`, `start`, `business`, `pro`). Нет связи между типом бизнеса и доступными модулями.

**Цель:** ввести чёткое разделение — тип бизнеса определяет **какие модули вообще существуют**, тариф определяет **что из них разблокировано**.

---

## Архитектурные решения (финальные)

### Типы бизнеса
```
retail   — продаёт товары (рестораны, магазины, пекарни, кафе)
services — продаёт время/услуги (салоны, клиники, фитнес, корты, прокат)
```

`food` и `retail` объединяются в один тип `retail`. Старый `businessType: 'food'` → `retail` + `menuStyle: 'food'`.

### Стиль меню (только для retail)
```
menuStyle: 'food'    → «Меню», «Блюда», «Категории»
menuStyle: 'catalog' → «Каталог», «Товары», «Разделы»
```

### Тарифы (одинаковые для обоих типов)
```
showcase — Витрина   (только сайт, без заказов/записи)
start    — Старт     (базовый операционный функционал)
pro      — Про       (полный функционал)
```

### Матрица модулей

| Модуль | retail/showcase | retail/start | retail/pro | services/showcase | services/start | services/pro |
|---|---|---|---|---|---|---|
| Витрина + каталог | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Заказы (доставка/самовывоз) | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Акции базовые (скидка %) | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Запись (до 3 ресурсов) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Запись без лимита + услуги | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Кухня (KDS) | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Столы / dine-in | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Бронирование столиков | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Комбо и сложные акции | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Филиалы | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Кастомные роли | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |

**Лимит ресурсов:** `services/start` — максимум 3 активных ресурса, проверяется в коде при создании.

### Правила
- Тип бизнеса: выбирается при онбординге, **не меняется** (форма сохранения в settings не позволяет менять)
- `menuStyle`: можно менять в настройках (только для retail)
- Тариф: апгрейд — самостоятельно в аккаунте; даунгрейд — пока запрещён (показать сообщение)
- Prod пуст, миграция существующих данных не нужна

---

## Фазы реализации

### Фаза 1 — DB & Shared Types

**Миграция `159_business_types_plans.sql`:**
```sql
-- 1. Добавить menu_style в tenants
ALTER TABLE tenants ADD COLUMN menu_style text NOT NULL DEFAULT 'food';

-- 2. Конвертировать 'food' → 'retail' (для существующих данных)
UPDATE tenants SET business_type = 'retail' WHERE business_type = 'food';
UPDATE tenants SET business_type = 'retail', menu_style = 'catalog' WHERE business_type = 'retail' AND menu_style = 'food';

-- 3. Обновить plans: переименовать/добавить тарифы
-- Старые: service, start, business, pro
-- Новые: showcase, start, pro
-- sort_order: showcase=0, start=1, pro=2
DELETE FROM plans;
INSERT INTO plans (key, name, sort_order) VALUES
  ('showcase', 'Витрина', 0),
  ('start', 'Старт', 1),
  ('pro', 'Про', 2);

-- 4. Обновить module_configs: добавить поле business_types (jsonb массив)
ALTER TABLE module_configs ADD COLUMN business_types jsonb NOT NULL DEFAULT '["retail","services"]'::jsonb;

-- Обновить каждый модуль согласно матрице:
UPDATE module_configs SET required_plan_key = 'start',  business_types = '["retail"]' WHERE key = 'delivery';
UPDATE module_configs SET required_plan_key = 'start',  business_types = '["retail"]' WHERE key = 'pickup';
UPDATE module_configs SET required_plan_key = 'start',  business_types = '["retail"]' WHERE key = 'modifiers';
UPDATE module_configs SET required_plan_key = 'start',  business_types = '["retail"]' WHERE key = 'addons';
UPDATE module_configs SET required_plan_key = 'start',  business_types = '["retail"]' WHERE key = 'promotions';
UPDATE module_configs SET required_plan_key = 'pro',    business_types = '["retail"]' WHERE key = 'combos';
UPDATE module_configs SET required_plan_key = 'pro',    business_types = '["retail"]' WHERE key = 'kitchen';
UPDATE module_configs SET required_plan_key = 'pro',    business_types = '["retail"]' WHERE key = 'dineIn';
UPDATE module_configs SET required_plan_key = 'pro',    business_types = '["retail","services"]' WHERE key = 'customRoles';
UPDATE module_configs SET required_plan_key = 'pro',    business_types = '["retail"]' WHERE key = 'reservations';
UPDATE module_configs SET required_plan_key = 'start',  business_types = '["services"]' WHERE key = 'services';
UPDATE module_configs SET required_plan_key = 'start',  business_types = '["retail","services"]' WHERE key = 'customers';

-- Добавить модуль branches (если не существует)
INSERT INTO module_configs (key, name, description, icon, required_plan_key, sort_order, business_types)
VALUES ('branches', 'Филиалы', 'Несколько точек под одним аккаунтом', 'mapPin', 'pro', 20, '["retail","services"]')
ON CONFLICT (key) DO UPDATE SET required_plan_key = 'pro', business_types = '["retail","services"]';
```

**`packages/shared/src/types/tenant.ts`:**
- `BusinessType = 'retail' | 'services'` (убрать `'food'`)
- Добавить `MenuStyle = 'food' | 'catalog'`
- Добавить `PlanKey = 'showcase' | 'start' | 'pro'`
- В `Tenant`: добавить `menuStyle: MenuStyle`
- В `TenantSubscription`: уточнить `plan: string` → можно оставить строкой, план приходит из БД

**`packages/shared/src/types/billing.ts`** (проверить, должен быть тип `Plan`):
- `Plan.key: string` — оставить строкой для гибкости

Экспортировать `MenuStyle`, `PlanKey` из `packages/shared/src/index.ts`.

---

### Фаза 2 — ModuleConfig с матрицей бизнес-типов

**`apps/admin/config/modules.ts`:**
```typescript
export type ModuleConfig = {
  key: ModuleKey
  name: string
  description: string
  icon: IconName
  requiredPlan: string
  sortOrder: number
  businessTypes: BusinessType[]  // добавить поле
}
```

**`apps/admin/utils/api/module-configs.ts`** (найти файл, он есть):
- В маппере добавить `businessTypes: (raw.business_types as BusinessType[]) ?? ['retail', 'services']`

**`apps/admin/composables/plan/useModules.ts`:**
- `useModules()` должен фильтровать модули по `businessType` тенанта: если `businessType` тенанта не входит в `moduleConfig.businessTypes` — модуль недоступен совсем (не locked, а absent)
- Обновить тип возврата: добавить `absent: boolean` к `ModuleState`
- `absent: true` — скрыть из UI полностью (не показывать даже заблокированным)

```typescript
type ModuleState = {
  active: boolean
  locked: boolean   // доступно по типу бизнеса, но не по тарифу
  absent: boolean   // недоступно для этого типа бизнеса вообще
  enabled: boolean  // active && !locked && !absent
}
```

---

### Фаза 3 — Лейблы и стор тенанта

**`apps/admin/stores/tenant.ts`** (найти файл):
- Убедиться что `menuStyle` читается из данных тенанта и доступен через стор

**`apps/admin/composables/plan/useTenantLabels.ts`:**
```typescript
// Было: if (businessType.value === 'food') return 'Меню'
// Стало: использовать menuStyle
const menuLabel = computed(() => {
  if (isServices.value) return 'Услуги'
  return menuStyle.value === 'food' ? 'Меню' : 'Каталог'
})
// itemLabel: isServices → 'услуга', menuStyle=food → 'блюдо', иначе → 'товар'
// itemsLabel: isServices → 'Услуги', food → 'Блюда', иначе → 'Товары'
```

Полный список лейблов обновить аналогично.

**`apps/admin/utils/api/tenants.ts`** (найти файл):
- В маппере тенанта добавить `menuStyle: raw.menu_style as MenuStyle ?? 'food'`

---

### Фаза 4 — Навигация и UI

**`apps/admin/components/layout/AppNav.vue`:**
- `canSeeReservations`: для `services` — показывать если `services` модуль enabled; для `retail` — если `reservations` модуль enabled
- Убрать из навигации `tables` если `businessType === 'services'`
- Раздел «Бронирования» для `services` должен называться «Запись» (использовать `useTenantLabels`)

**`apps/admin/pages/settings/modules.vue`:**
- Фильтровать список модулей: скрывать те у которых `absent: true`
- Заблокированные (`locked: true`) показывать с badge тарифа как сейчас

**`apps/admin/pages/settings/general.vue`** (или где сейчас настройки тенанта):
- Поле `menuStyle` (select: «Меню/Блюда» vs «Каталог/Товары») — только для `businessType === 'retail'`
- Поле `businessType` — показывать только для чтения, без возможности изменить

---

### Фаза 5 — Онбординг

Найти файл онбординга (скорее всего `apps/admin/pages/onboarding.vue` или похожее).

Добавить шаг выбора типа бизнеса:
1. **Тип бизнеса**: две карточки — «Продаю товары / еду» (retail) и «Оказываю услуги / принимаю запись» (services)
2. **Стиль меню** (только если выбрали retail): «Ресторан / кафе / еда» (`food`) или «Магазин / каталог» (`catalog`)

После выбора — `businessType` и `menuStyle` сохраняются в тенант. Поле `businessType` после сохранения менять нельзя (защита на уровне API или UI).

---

### Фаза 6 — Апгрейд тарифа в аккаунте

Файл: `apps/admin/pages/account.vue` (или `/account/billing.vue`).

Добавить секцию «Тариф»:
- Показать текущий тариф (badge с именем)
- Показать все три тарифа в виде карточек с описанием фич для **текущего типа бизнеса**
- Кнопка «Перейти на Про» (или «Старт»): апгрейд разрешён, даунгрейд — кнопка disabled с тултипом «Обратитесь в поддержку»
- При апгрейде: вызвать API `tenantsApi.updatePlan(tenantId, planKey)`, обновить стор

Для биллинга: цену пока не показываем (или заглушка «Уточнить стоимость»). Задача только в хранении и отображении тарифа.

**`apps/admin/utils/api/tenants.ts`** (добавить метод):
```typescript
async updatePlan(sb, tenantId, planKey) {
  // UPDATE tenants SET subscription = jsonb_set(subscription, '{plan}', '"pro"') WHERE id = ...
  // или как сейчас хранится план — проверить схему
}
```

**Проверить где хранится текущий план:**
- Скорее всего в `tenant_subscriptions` или в `tenants.subscription` (jsonb). Уточнить в миграциях.

---

### Фаза 7 — Лимит ресурсов для services/start

**`apps/admin/utils/api/resources.ts`** → метод `create`:
- Перед созданием: если `businessType === 'services'` и `plan === 'start'`, посчитать активные ресурсы тенанта
- Если `count >= 3` — бросить ошибку с сообщением «На тарифе Старт доступно максимум 3 ресурса. Перейдите на Про для неограниченного количества»

Или вынести проверку в composable `useResources.ts` → метод `create`.

---

### Фаза 8 — Лендинг

Файл: `apps/landing/components/sections/PricingSection.vue`.

Сейчас там хардкод. Переделать:
- Два таба или переключатель: «Магазины и рестораны» (retail) / «Услуги и запись» (services)
- Три карточки тарифов для каждого типа: Витрина / Старт / Про
- Описание фич в каждой карточке — согласно матрице из этого плана
- Цены: пока заглушка или убрать цифры, поставить «Уточнить» / «Бесплатно» для Витрины

Компонент должен переключаться между двумя наборами карточек без перезагрузки страницы.

---

### Фаза 9 — Бэкофис

Файл: `apps/backoffice/pages/plans.vue`.

Сейчас: CRUD тарифов (ключ, имя, цена, sort_order).

Добавить:
- Поле `business_types` не нужно редактировать — оно на уровне `module_configs`
- Отображение: при просмотре тарифа показывать какие модули в него входят (по `module_configs`)

Файл: `apps/backoffice/pages/tenants/[id].vue`.

Добавить:
- Отображение `businessType` и `menuStyle` тенанта
- Возможность сменить тариф вручную (нужно для даунгрейда который пользователь не может сделать сам)
- Кнопка «Сменить тариф» → select из трёх вариантов → сохранить

---

## Важные файлы для изучения перед началом

- `packages/shared/src/types/tenant.ts` — типы тенанта
- `packages/shared/src/types/billing.ts` — тип `Plan`
- `apps/admin/stores/tenant.ts` — стор тенанта, как читается subscription/plan
- `apps/admin/utils/api/tenants.ts` — как маппится тенант из БД
- `apps/admin/utils/api/module-configs.ts` — маппер module_configs
- `apps/admin/composables/plan/useModules.ts` — логика модулей
- `apps/admin/composables/plan/usePlanFeatures.ts` — откуда берётся текущий план
- `apps/admin/composables/plan/usePlans.ts` — список планов из БД
- `apps/admin/composables/plan/useTenantLabels.ts` — лейблы
- `apps/admin/config/modules.ts` — тип ModuleConfig
- `apps/admin/components/layout/AppNav.vue` — навигация
- `apps/admin/pages/settings/modules.vue` — страница модулей
- `apps/backoffice/pages/plans.vue` — управление тарифами в бэкофисе
- `apps/backoffice/pages/tenants/[id].vue` — карточка тенанта в бэкофисе
- `apps/landing/components/sections/PricingSection.vue` — секция тарифов на лендинге

---

## Что НЕ делаем в этой итерации

- Реальный биллинг и оплата (цены — заглушки)
- Автоматический даунгрейд при неоплате
- Блокировка аккаунта при просрочке
- Уведомления об истечении триала
- Смена типа бизнеса через UI (только вручную через бэкофис)
