# Unified Item Manager Modal — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Единая модалка-менеджер для редактирования статусов заказов и категорий меню — с drag-and-drop, inline-редактированием, выбором цвета и специфичными полями для каждого типа.

**Architecture:** Один переиспользуемый компонент `ItemManagerModal` с плашками-элементами на всю ширину. Каждая плашка содержит: drag handle, цветной кружок (клик -> палитра пресетов + кастомный пикер), inline-editable имя, и type-specific контролы (группа статуса / фото+активность категории). Модалка открывается по клику на иконку карандашика рядом с заголовком секции.

**Tech Stack:** Vue 3, `@fastio/ui`, `vue-draggable-plus`, Naive UI `NColorPicker`, Supabase (миграция для поля `color`).

---

## Обзор изменений

### Новые файлы
- `apps/admin/components/ui/ItemManagerModal.vue` — основная модалка-менеджер
- `apps/admin/components/ui/ColorPicker.vue` — компонент выбора цвета (пресеты + кастомный)
- `supabase/migrations/016_item_colors.sql` — миграция: добавить `color` в `order_statuses` и `categories`

### Модифицируемые файлы
- `packages/shared/src/types/order.ts` — добавить `color` в `OrderStatus`
- `packages/shared/src/types/menu.ts` — добавить `color` в `Category`
- `apps/admin/utils/api/db-types.ts` — добавить `color` в row-типы
- `apps/admin/utils/api/order-statuses.ts` — маппинг + API для `color`
- `apps/admin/utils/api/categories.ts` — маппинг + API для `color`
- `apps/admin/composables/useOrderStatuses.ts` — расширить `add`/`update` для `color`
- `apps/admin/composables/useCategories.ts` — расширить `add`/`update` для `color`
- `apps/admin/components/menu/CategoryList.vue` — убрать встроенную модалку, добавить карандашик, использовать `ItemManagerModal`
- `apps/admin/pages/orders/index.vue` — убрать `OrderStatusModal`, добавить карандашик, использовать `ItemManagerModal`
- `apps/admin/components/ui/SectionHeader.vue` — добавить слот/проп для иконки действия
- `apps/admin/config/order-status-groups.ts` — палитра пресетных цветов

### Удаляемые файлы
- `apps/admin/components/orders/OrderStatusModal.vue` — заменяется `ItemManagerModal`

---

## Task 1: Миграция БД — добавить `color`

**Files:**
- Create: `supabase/migrations/016_item_colors.sql`

**Step 1: Создать миграцию**

```sql
-- Add color column to order_statuses and categories
ALTER TABLE order_statuses ADD COLUMN color text;
ALTER TABLE categories ADD COLUMN color text;
```

**Step 2: Commit**

```bash
git add supabase/migrations/016_item_colors.sql
git commit -m "feat(no-refs): add color column to order_statuses and categories"
```

---

## Task 2: Обновить shared-типы и db-types

**Files:**
- Modify: `packages/shared/src/types/order.ts`
- Modify: `packages/shared/src/types/menu.ts`
- Modify: `apps/admin/utils/api/db-types.ts`

**Step 1: Добавить `color` в `OrderStatus`**

В `packages/shared/src/types/order.ts`, добавить поле в тип `OrderStatus`:

```typescript
export type OrderStatus = {
  id: string
  tenantId: string
  name: string
  groupType: OrderStatusGroup
  position: number
  color: string | null  // <-- добавить
}
```

**Step 2: Добавить `color` в `Category`**

В `packages/shared/src/types/menu.ts`, добавить поле в тип `Category`:

```typescript
export type Category = {
  id: string
  tenantId: string
  name: string
  order: number
  active: boolean
  photoUrl: string | null
  useFirstDishPhoto: boolean
  color: string | null  // <-- добавить
}
```

**Step 3: Добавить `color` в row-типы**

В `apps/admin/utils/api/db-types.ts`, добавить `color: string | null` в оба row-типа: `OrderStatusRow` и `CategoryRow`.

**Step 4: Commit**

```bash
git add packages/shared/src/types/order.ts packages/shared/src/types/menu.ts apps/admin/utils/api/db-types.ts
git commit -m "feat(no-refs): add color field to OrderStatus and Category types"
```

---

## Task 3: Обновить API-слой и composables

**Files:**
- Modify: `apps/admin/utils/api/order-statuses.ts`
- Modify: `apps/admin/utils/api/categories.ts`
- Modify: `apps/admin/composables/useOrderStatuses.ts`
- Modify: `apps/admin/composables/useCategories.ts`

**Step 1: order-statuses API**

В `mapOrderStatus` добавить: `color: row.color ?? null`

В `add` — принимать `color?: string | null` в `data`, передавать `color: data.color ?? null` в insert.

В `update` — принимать `color?: string | null` в `data`, передавать в update.

Обновить тип параметра `data` в `add` и `update`:
```typescript
type StatusData = { name: string; groupType: OrderStatusGroup; color?: string | null }
```

**Step 2: categories API**

В `mapCategory` добавить: `color: row.color ?? null`

В `add` payload добавить `color?: string | null`, передавать `color` в insert через `filterDefined`.

В `update` data type добавить `color` в `Partial<Pick<...>>`.

**Step 3: useOrderStatuses composable**

Обновить тип `data` в `add` и `update` чтобы принимать `color`.

**Step 4: useCategories composable**

Обновить `add` — вместо `(name, photo?)` сделать `(data: { name: string; color?: string | null; photoUrl?: string | null; useFirstDishPhoto?: boolean })`.

Обновить `update` — добавить `color` в допустимые поля.

**Step 5: Commit**

```bash
git add apps/admin/utils/api/order-statuses.ts apps/admin/utils/api/categories.ts apps/admin/composables/useOrderStatuses.ts apps/admin/composables/useCategories.ts
git commit -m "feat(no-refs): support color in statuses and categories API layer"
```

---

## Task 4: Палитра пресетных цветов + ColorPicker

**Files:**
- Modify: `apps/admin/config/order-status-groups.ts` — экспортировать `PRESET_COLORS`
- Create: `apps/admin/components/ui/ColorPicker.vue`

**Step 1: Добавить пресеты цветов**

В `apps/admin/config/order-status-groups.ts` добавить экспорт:

```typescript
export const PRESET_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#EAB308', // yellow
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F97316', // orange
  '#06B6D4', // cyan
  '#6B7280', // grey
  '#000000', // black
]
```

**Step 2: Создать `ColorPicker.vue`**

Компонент: кружки пресетных цветов в ряд + кнопка "кастомный" (открывает Naive UI `NColorPicker`).

```vue
<template>
  <div class="color-picker-root">
    <button
      v-for="color in PRESET_COLORS"
      :key="color"
      class="swatch"
      :class="{ active: modelValue === color }"
      :style="{ background: color }"
      @click="$emit('update:modelValue', color)"
    />
    <NPopover trigger="click" placement="bottom" :show-arrow="false">
      <template #trigger>
        <button
          class="swatch custom"
          :style="isCustom ? { background: modelValue } : {}"
          :class="{ active: isCustom }"
        >
          <UiIcon v-if="!isCustom" name="palette" :size="14" />
        </button>
      </template>
      <NColorPicker
        :value="modelValue ?? '#3B82F6'"
        :show-alpha="false"
        :modes="['hex']"
        style="width: 200px"
        @update:value="$emit('update:modelValue', $event)"
      />
    </NPopover>
  </div>
</template>
```

Props: `modelValue: string | null`. Emit: `update:modelValue`.

`isCustom` = computed — `modelValue` не `null` и не входит в `PRESET_COLORS`.

Стили: `.swatch` — кружки 24x24, border-radius 50%, cursor pointer. `.active` — ring/outline. `.custom` — пунктирный бордер если не кастомный.

**Step 3: Commit**

```bash
git add apps/admin/config/order-status-groups.ts apps/admin/components/ui/ColorPicker.vue
git commit -m "feat(no-refs): add ColorPicker component with presets and custom picker"
```

---

## Task 5: Компонент `ItemManagerModal`

**Files:**
- Create: `apps/admin/components/ui/ItemManagerModal.vue`

**Step 1: Создать компонент**

Это основной компонент. `UiModal` с `VueDraggable` списком плашек.

**Props:**
```typescript
type ManagedItem = {
  id: string
  name: string
  color: string | null
  // Статусы
  groupType?: OrderStatusGroup
  // Категории
  active?: boolean
  photoUrl?: string | null
  useFirstDishPhoto?: boolean
}

type Props = {
  modelValue: boolean           // open/close
  title: string                 // "Статусы" / "Категории"
  items: ManagedItem[]          // список элементов
  mode: 'statuses' | 'categories'
}
```

**Emits:**
```typescript
type Emits = {
  'update:modelValue': [value: boolean]
  'add': [data: Partial<ManagedItem>]
  'update': [id: string, data: Partial<ManagedItem>]
  'remove': [id: string]
  'reorder': [items: ManagedItem[]]
}
```

**Шаблон (псевдокод структуры):**

```
UiModal (title, width=600, no default actions)
  VueDraggable (v-model="localItems", handle=".drag-handle", @end="onReorder")
    div.item-row (v-for item)
      UiIcon(name="grip", class="drag-handle")      — drag handle

      button.color-dot(@click="toggleColorPicker(item.id)")  — цветной кружок
        style: background = item.color ?? defaultColor

      ColorPicker(v-if="colorPickerOpenId === item.id")  — палитра под плашкой

      input.name-input(v-model="item.name", @blur="saveName(item)")  — inline имя
        (по умолчанию выглядит как текст, фокус -> поле ввода)

      // --- type-specific controls ---

      // Статусы: селект группы
      UiSelect(v-if="mode === 'statuses'", v-model="item.groupType", :options="groupOptions", size="tiny")

      // Категории: фото превью + активность
      template(v-if="mode === 'categories'")
        button.photo-thumb(@click="openPhotoPicker(item)")  — маленькое превью фото
        UiSwitch(v-model="item.active", size="small")        — активность

      UiButton(icon="trash", type="text", size="tiny", @click="confirmRemove(item)")

  div.add-row
    UiButton(icon="plus", type="text", @click="addItem")  — "+ Добавить"
```

**Ключевая логика:**

1. `localItems` = shallow copy из `props.items`, обновляется при изменении props
2. Inline-редактирование: input всегда рендерится, но стилизован как текст. По фокусу — появляется бордер. По blur — emit `update` если имя изменилось
3. Цвет: клик по кружку тогглит `ColorPicker` под плашкой (через `colorPickerOpenId`). При выборе цвета — сразу emit `update`
4. Группа статуса: при изменении селекта — emit `update`
5. Drag-and-drop: `@end` -> emit `reorder` с новым порядком
6. Удаление: `useConfirm()` перед удалением, emit `remove`
7. Добавление: emit `add` с дефолтными значениями `{ name: 'Новый элемент', color: PRESET_COLORS[0] }`
8. Фото категорий: клик по превью открывает `DishPhotoUpload` в попапе/секции под плашкой (аналогично color picker)

**Стили:**

```scss
.item-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--color-bg-secondary, var(--n-color));

  &:not(:last-child) { margin-bottom: 6px; }
}

.drag-handle {
  cursor: grab;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  &:active { cursor: grabbing; }
}

.color-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s;
  &:hover { border-color: var(--color-border); }
}

.name-input {
  flex: 1;
  border: 1px solid transparent;
  background: transparent;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--color-text-primary);
  outline: none;
  &:focus { border-color: var(--color-primary); background: var(--color-bg-primary); }
}

.photo-thumb {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  border: 1px dashed var(--color-border);
  img { width: 100%; height: 100%; object-fit: cover; }
}

.add-row {
  padding-top: 10px;
  border-top: 1px solid var(--color-border);
  margin-top: 4px;
}
```

**Step 2: Commit**

```bash
git add apps/admin/components/ui/ItemManagerModal.vue
git commit -m "feat(no-refs): add ItemManagerModal component"
```

---

## Task 6: Добавить иконку-карандашик в `SectionHeader`

**Files:**
- Modify: `apps/admin/components/ui/SectionHeader.vue`

**Step 1: Добавить проп/событие для action-иконки**

Добавить проп `editable?: boolean` и emit `edit`. Если `editable` — рядом с label рендерится `UiButton` с иконкой `pencil`, `type="text"`, `size="tiny"`.

Текущий слот `<slot />` остаётся для правой части (уже используется).

```vue
<template>
  <div class="section-header-root">
    <span class="left">
      <span class="label">{{ label }}</span>
      <UiButton
        v-if="editable"
        type="text"
        size="tiny"
        icon="pencil"
        class="edit-btn"
        @click="$emit('edit')"
      />
    </span>
    <slot />
  </div>
</template>
```

Стили: `.left` — flex, align-items center, gap 6px. `.edit-btn` — opacity 0.5, hover -> 1.

**Step 2: Commit**

```bash
git add apps/admin/components/ui/SectionHeader.vue
git commit -m "feat(no-refs): add editable prop to SectionHeader"
```

---

## Task 7: Интегрировать в страницу заказов

**Files:**
- Modify: `apps/admin/pages/orders/index.vue`
- Delete: `apps/admin/components/orders/OrderStatusModal.vue`

**Step 1: Заменить `OrderStatusModal` на `ItemManagerModal`**

1. Убрать импорт `OrderStatusModal`
2. Импортировать `ItemManagerModal`
3. Добавить `import { PRESET_COLORS } from '~/config/order-status-groups'`
4. В template: заменить `<OrderStatusModal>` на `<ItemManagerModal>`:

```vue
<ItemManagerModal
  v-model="statusManagerOpen"
  title="Статусы"
  mode="statuses"
  :items="managerItems"
  @add="handleManagerAdd"
  @update="handleManagerUpdate"
  @remove="handleManagerRemove"
  @reorder="handleManagerReorder"
/>
```

5. `managerItems` = computed маппинг из `statuses` в `ManagedItem`
6. Обработчики: вызывают `addStatus`, `updateStatus`, `removeStatus` (из `useOrderStatuses` — добавить `remove`, `reorder`)
7. На `<UiSectionHeader>` добавить `editable @edit="statusManagerOpen = true"`

**Step 2: Удалить `OrderStatusModal.vue`**

**Step 3: Commit**

```bash
git add apps/admin/pages/orders/index.vue
git rm apps/admin/components/orders/OrderStatusModal.vue
git commit -m "feat(no-refs): replace OrderStatusModal with ItemManagerModal on orders page"
```

---

## Task 8: Интегрировать в `CategoryList`

**Files:**
- Modify: `apps/admin/components/menu/CategoryList.vue`

**Step 1: Заменить встроенную модалку на `ItemManagerModal`**

1. Убрать весь код текущей модалки (`<UiModal>`, `formRef`, `categoryForm`, `onConfirm`, etc.)
2. Импортировать `ItemManagerModal`
3. Добавить `<ItemManagerModal>` в template:

```vue
<ItemManagerModal
  v-model="managerOpen"
  title="Категории"
  mode="categories"
  :items="managerItems"
  @add="handleAdd"
  @update="handleUpdate"
  @remove="handleRemove"
  @reorder="handleReorder"
/>
```

4. `managerItems` = computed маппинг из `categories` в `ManagedItem`
5. Обработчики: вызывают `addCategory`, `updateCategory`, `removeCategory`, `reorder`
6. На `<UiSectionHeader>` добавить `editable @edit="managerOpen = true"`
7. Для фото — обработка загрузки/удаления остаётся через `categoriesApi.uploadPhoto` / `deletePhoto` (вызывается из обработчика `handleUpdate`)

**Step 2: Commit**

```bash
git add apps/admin/components/menu/CategoryList.vue
git commit -m "feat(no-refs): replace inline category modal with ItemManagerModal"
```

---

## Task 9: Использовать `color` в табах

**Files:**
- Modify: `apps/admin/pages/orders/index.vue` — `statusTabs` computed использует `s.color` если задан
- Modify: `apps/admin/components/menu/CategoryList.vue` — `categoryTabs` computed использует `c.color`

Сейчас `UiTabs` -> `UiTag` поддерживает только предустановленные `type` ('primary', 'success', etc.). Для кастомных цветов нужно либо:
- Расширить `UiTag`/`UiTabs` для кастомного цвета (чище)
- Или передавать style override

**Рекомендация:** Добавить опциональное поле `color?: string` в `TabItem` типа `UiTabs`. Если `color` задан — он переопределяет `type`-based цвет через style binding на `UiTag`.

**Step 1: Расширить `UiTabs` для кастомного цвета**

В `packages/ui/src/components/UiTabs.vue`:
- Добавить `color?: string` в тип `TabItem`
- Передать `color` как проп в `UiTag`

В `packages/ui/src/components/UiTag.vue`:
- Добавить проп `color?: string` (hex цвет)
- Если `color` задан — использовать его вместо `TAG_COLORS[type]` в `tagColor` computed

**Step 2: В orders page и CategoryList — передавать `color` в tabs**

```typescript
const statusTabs = computed(() => statuses.value.map((s) => ({
  value: s.id,
  label: s.name,
  type: STATUS_GROUP_TAG_TYPES[s.groupType],
  color: s.color ?? undefined,  // кастомный цвет переопределяет type
  count: statusCounts.value[s.id] ?? 0,
})))
```

**Step 3: Commit**

```bash
git add packages/ui/src/components/UiTabs.vue packages/ui/src/components/UiTag.vue apps/admin/pages/orders/index.vue apps/admin/components/menu/CategoryList.vue
git commit -m "feat(no-refs): support custom color in UiTabs and UiTag"
```

---

## Task 10: Финальная проверка и cleanup

**Step 1:** Убедиться что `AppEditableTag.vue` больше нигде не используется (если использовалась для статусов/категорий). Если не используется — удалить.

**Step 2:** Проверить что все импорты корректны, нет unused imports.

**Step 3:** Ручное тестирование:
- Открыть страницу заказов → карандашик у "Статусы" → модалка
- Drag-and-drop статусов
- Inline-редактирование имени
- Выбор цвета (пресет + кастомный)
- Смена группы статуса
- Добавление / удаление статуса
- Открыть страницу меню → карандашик у "Категории" → модалка
- Те же действия + фото + активность

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(no-refs): unified item manager modal for statuses and categories"
```
