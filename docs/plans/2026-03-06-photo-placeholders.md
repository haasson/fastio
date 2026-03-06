# Photo Placeholders & Category Photo Upload — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Заменить эмодзи-плейсхолдеры блюд на красивые SVG-иллюстрации и добавить загрузку фото категорий в ItemManagerModal.

**Architecture:** Один SVG-компонент `DishPlaceholder.vue` с мягким градиентом и иконкой столовых приборов, используемый везде где нужен плейсхолдер (admin карточки/список, storefront карточки/модалка). Для категорий — compact photo thumbnail в строке ItemManagerModal с кликом для загрузки.

**Tech Stack:** Vue 3, SVG inline, `@fastio/ui`, существующий `PhotoUpload` компонент, Supabase Storage.

---

## Обзор изменений

### Новые файлы
- `packages/ui/src/components/UiPhotoPlaceholder.vue` — SVG-плейсхолдер для пустых фото

### Модифицируемые файлы
- `packages/ui/src/index.ts` — экспорт `UiPhotoPlaceholder`
- `apps/admin/components/menu/DishList.vue` — заменить 🍽 на `UiPhotoPlaceholder`
- `apps/admin/components/ui/ItemManagerModal.vue` — добавить photo thumbnail для категорий
- `apps/admin/components/menu/CategoryList.vue` — передать tenantId и photo-related данные
- `apps/storefront/components/menu/DishCard.vue` — заменить 🍽 на `UiPhotoPlaceholder`
- `apps/storefront/components/menu/DishModal.vue` — заменить 🍽 на `UiPhotoPlaceholder`

---

## Task 1: SVG-плейсхолдер компонент

**Files:**
- Create: `packages/ui/src/components/UiPhotoPlaceholder.vue`
- Modify: `packages/ui/src/index.ts`

**Step 1: Создать `UiPhotoPlaceholder.vue`**

Компонент — inline SVG с мягким градиентным фоном и иконкой столовых приборов. Принимает проп `size` для управления размером иконки.

```vue
<template>
  <div class="placeholder-root">
    <svg
      :width="iconSize"
      :height="iconSize"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Вилка и нож (UtensilsCrossed из Lucide) -->
      <path
        d="M16 2v17.5c0 .83-.67 1.5-1.5 1.5S13 20.33 13 19.5V12h-1V2"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M3 2v4c0 1.1.9 2 2 2h3c1.1 0 2-.9 2-2V2"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M7 2v20"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M21 15H3"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: 'small' | 'medium' | 'large'
}>(), { size: 'medium' })

const iconSize = computed(() => {
  const map = { small: 20, medium: 32, large: 48 }
  return map[props.size]
})
</script>

<style scoped>
.placeholder-root {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--placeholder-from, #f0f1f3) 0%, var(--placeholder-to, #e4e7eb) 100%);
  color: var(--placeholder-icon, #b0b8c4);
}
</style>
```

> **Note:** SVG — это упрощённые столовые приборы (нож + вилка). Не Lucide напрямую, а кастомный набор линий. Итоговый SVG подобрать так, чтобы смотрелся аккуратно при всех размерах.

**Step 2: Экспортировать из UI пакета**

В `packages/ui/src/index.ts` добавить:
```ts
export { default as UiPhotoPlaceholder } from './components/UiPhotoPlaceholder.vue'
```

**Step 3: Commit**
```
feat(ui): add UiPhotoPlaceholder component with gradient SVG
```

---

## Task 2: Заменить плейсхолдеры в admin — DishList

**Files:**
- Modify: `apps/admin/components/menu/DishList.vue`

**Step 1: Заменить эмодзи в cards view**

Строка ~54: заменить `<span v-else class="photo-placeholder">🍽</span>` на:
```vue
<UiPhotoPlaceholder v-else size="medium" />
```

**Step 2: Заменить эмодзи в list view**

Строка ~109: заменить `<span v-else class="list-photo-placeholder">🍽</span>` на:
```vue
<UiPhotoPlaceholder v-else size="small" />
```

**Step 3: Убрать неиспользуемые стили**

Удалить `.photo-placeholder` и `.list-photo-placeholder` из `<style>`.

**Step 4: Добавить импорт**

В импортах добавить `UiPhotoPlaceholder` из `@fastio/ui`.

**Step 5: Commit**
```
feat(admin): replace dish emoji placeholders with UiPhotoPlaceholder
```

---

## Task 3: Заменить плейсхолдеры в storefront

**Files:**
- Modify: `apps/storefront/components/menu/DishCard.vue`
- Modify: `apps/storefront/components/menu/DishModal.vue`

**Step 1: DishCard.vue**

Строка 5: заменить `<span v-else class="photo-placeholder">🍽</span>` на:
```vue
<UiPhotoPlaceholder v-else size="medium" />
```

Добавить импорт `UiPhotoPlaceholder` из `@fastio/ui`. Удалить стиль `.photo-placeholder`.

**Step 2: DishModal.vue**

Строка 9: заменить `<span v-else class="photo-placeholder">🍽</span>` на:
```vue
<UiPhotoPlaceholder v-else size="large" />
```

Добавить импорт `UiPhotoPlaceholder` из `@fastio/ui`. Удалить стиль `.photo-placeholder`.

**Step 3: Commit**
```
feat(storefront): replace dish emoji placeholders with UiPhotoPlaceholder
```

---

## Task 4: Photo upload в ItemManagerModal для категорий

**Files:**
- Modify: `apps/admin/components/ui/ItemManagerModal.vue`
- Modify: `apps/admin/components/menu/CategoryList.vue`

Это самая сложная часть. В строку категории добавляем compact thumbnail: маленькое круглое фото (или плейсхолдер), при клике — file picker.

**Step 1: Расширить `ManagedItem` тип**

В `ItemManagerModal.vue` добавить в `ManagedItem`:
```ts
export type ManagedItem = {
  id: string
  name: string
  groupType?: OrderStatusGroup
  quickActions?: string[]
  photoUrl?: string | null
}
```

**Step 2: Добавить emit для фото**

Добавить новый emit:
```ts
'updatePhoto': [id: string, file: File | null]
```

**Step 3: Добавить photo thumbnail в template**

В `.item-row`, после drag handle и перед name input, добавить thumbnail (только для mode === 'categories'):

```vue
<label v-if="mode === 'categories'" class="photo-thumb" :for="`photo-${item.id}`">
  <img v-if="photoPreview[item.id] ?? item.photoUrl" :src="photoPreview[item.id] ?? item.photoUrl!" alt="" />
  <UiPhotoPlaceholder v-else size="small" />
  <input
    :id="`photo-${item.id}`"
    type="file"
    accept="image/*"
    class="hidden-input"
    @change="onPhotoChange(item.id, $event)"
  />
</label>
```

**Step 4: Добавить логику фото**

```ts
const photoPreview = ref<Record<string, string>>({})

const onPhotoChange = (id: string, event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (photoPreview.value[id]) URL.revokeObjectURL(photoPreview.value[id])
  photoPreview.value[id] = URL.createObjectURL(file)
  emit('updatePhoto', id, file)
  ;(event.target as HTMLInputElement).value = ''
}
```

Очистить превью при закрытии модалки:
```ts
watch(() => props.modelValue, (val) => {
  if (!val) {
    Object.values(photoPreview.value).forEach(URL.revokeObjectURL)
    photoPreview.value = {}
  }
})
```

**Step 5: Добавить стили**

```scss
.photo-thumb {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.hidden-input {
  display: none;
}
```

**Step 6: CategoryList.vue — обработать загрузку фото**

Передать `photoUrl` в `managerItems`:
```ts
const managerItems = computed<ManagedItem[]>(() =>
  categories.value.map((c) => ({
    id: c.id,
    name: c.name,
    photoUrl: c.photoUrl,
  })),
)
```

Добавить handler:
```ts
const handleUpdatePhoto = async (id: string, file: File) => {
  const url = await api.categories.uploadPhoto(tenantId.value, file)

  // Удалить старое фото если было
  const cat = categories.value.find((c) => c.id === id)
  if (cat?.photoUrl) {
    await api.categories.deletePhoto(cat.photoUrl)
  }

  await updateCategory(id, { photoUrl: url })
}
```

Передать в ItemManagerModal:
```vue
<ItemManagerModal
  ...
  @update-photo="handleUpdatePhoto"
/>
```

Добавить `useSupabaseApi` импорт:
```ts
const api = useSupabaseApi()
```

**Step 7: Commit**
```
feat(admin): add category photo upload in ItemManagerModal
```

---

## Порядок выполнения

1. Task 1 — создать компонент плейсхолдера (фундамент)
2. Task 2 — admin dish placeholders
3. Task 3 — storefront dish placeholders
4. Task 4 — category photo upload в ItemManagerModal
