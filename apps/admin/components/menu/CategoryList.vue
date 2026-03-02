<template>
  <aside class="categories-root">
    <div class="panel-header">
      <span class="panel-title">Категории</span>
      <UiButton size="small" type="tertiary" @click="openCategoryModal(null)">+ Добавить</UiButton>
    </div>

    <UiSkeleton v-if="categoriesLoading" text :repeat="5" class="skeleton" />

    <ul v-else class="category-list">
      <li
        v-for="cat in categories"
        :key="cat.id"
        class="category-item"
        :class="{ selected: modelValue === cat.id, inactive: !cat.active }"
        @click="$emit('update:modelValue', cat.id)"
      >
        <span class="cat-name">{{ cat.name }}</span>
        <span class="cat-count">{{ dishCountByCategory[cat.id] ?? 0 }}</span>
        <div class="cat-actions" @click.stop>
          <button class="icon-btn" title="Редактировать" @click="openCategoryModal(cat)">
            <UiIcon name="pencil" :size="16" />
          </button>
          <button class="icon-btn" title="Удалить" @click="confirmDeleteCategory(cat.id)">
            <UiIcon name="trash" :size="16" />
          </button>
        </div>
      </li>

      <li v-if="categories.length === 0" class="category-empty">
        Категорий пока нет
      </li>
    </ul>

    <UiModal
      v-model="categoryModalOpen"
      :title="editingCategory ? 'Редактировать категорию' : 'Новая категория'"
      :width="400"
    >
      <UiSpace :size="16" vertical>
        <UiInput v-model="categoryForm.name" label="Название" placeholder="Например: Пицца" autofocus />
        <div class="form-footer">
          <UiSpace :size="8">
            <UiButton type="tertiary" @click="categoryModalOpen = false">Отмена</UiButton>
            <UiButton type="primary" :loading="saving" @click="saveCategory">Сохранить</UiButton>
          </UiSpace>
        </div>
      </UiSpace>
    </UiModal>
  </aside>
</template>

<script setup lang="ts">
import { UiModal, UiInput, UiButton, UiIcon, UiSkeleton, UiSpace, useConfirm } from '@fastfood-saas/ui'
import type { Category } from '@fastfood-saas/shared'

const props = defineProps<{
  tenantId: string
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [id: string | null]
}>()

const tenantIdRef = computed(() => props.tenantId)

const { categories, loading: categoriesLoading, add: addCategory, update: updateCategory, remove: removeCategory } =
  useCategories(tenantIdRef)

const { counts: dishCountByCategory } = useDishCounts(tenantIdRef)

const { confirm } = useConfirm()

const categoryModalOpen = ref(false)
const editingCategory = ref<Category | null>(null)
const categoryForm = reactive({ name: '' })
const saving = ref(false)

function openCategoryModal(cat: Category | null) {
  editingCategory.value = cat
  categoryForm.name = cat?.name ?? ''
  categoryModalOpen.value = true
}

async function saveCategory() {
  saving.value = true
  try {
    if (editingCategory.value) {
      await updateCategory(editingCategory.value.id, { name: categoryForm.name })
    } else {
      await addCategory(categoryForm.name)
    }
    categoryModalOpen.value = false
  } finally {
    saving.value = false
  }
}

async function confirmDeleteCategory(id: string) {
  const ok = await confirm({
    title: 'Удалить категорию?',
    message: 'Блюда в ней останутся в базе.',
    confirmText: 'Удалить',
    confirmType: 'error',
  })
  if (!ok) return
  if (props.modelValue === id) emit('update:modelValue', null)
  await removeCategory(id)
}
</script>

<style scoped lang="scss">
.categories-root {
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.panel-title {
  font-size: 15px;
  font-weight: 700;
  color: #111;
}

.skeleton {
  margin: 12px;
}

.category-list {
  list-style: none;
  overflow-y: auto;
  flex: 1;
  padding: 8px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: #f7f7f7;

    .cat-actions {
      opacity: 1;
    }
  }

  &.selected {
    background: #fff4f0;
  }

  &.inactive .cat-name {
    opacity: 0.45;
    text-decoration: line-through;
  }
}

.cat-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-count {
  font-size: 12px;
  color: #aaa;
  background: #f5f5f5;
  border-radius: 6px;
  padding: 1px 6px;
}

.cat-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #bbb;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: #f0f0f0;
    color: #333;
  }
}

.category-empty {
  padding: 24px;
  text-align: center;
  color: #bbb;
  font-size: 13px;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
