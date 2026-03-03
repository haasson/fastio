<template>
  <aside class="categories-root">
    <div class="panel-header">
      <span class="panel-title">Категории</span>
      <UiButton
        size="small"
        type="tertiary"
        icon="plus"
        @click="openCategoryModal(null)"
      >Добавить</UiButton>
    </div>

    <UiSkeleton
      v-if="categoriesLoading"
      text
      :repeat="5"
      class="skeleton"
    />

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
          <UiButton
            type="text"
            size="tiny"
            icon="pencil"
            title="Редактировать"
            @click="openCategoryModal(cat)"
          />
          <UiButton
            type="text"
            size="tiny"
            icon="trash"
            title="Удалить"
            @click="confirmDeleteCategory(cat.id)"
          />
        </div>
      </li>

      <UiAppEmpty v-if="categories.length === 0" text="Категорий пока нет" />
    </ul>

    <UiModal
      v-model="categoryModalOpen"
      :title="editingCategory ? 'Редактировать категорию' : 'Новая категория'"
      :width="400"
    >
      <UiSpace :size="16" vertical>
        <UiInput
          v-model="categoryForm.name"
          label="Название"
          placeholder="Например: Пицца"
          autofocus
        />
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
import { ref, computed, reactive, watch } from 'vue'
import { UiModal, UiInput, UiButton, UiSkeleton, UiSpace, useConfirm } from '@fastio/ui'
import type { Category } from '@fastio/shared'
import UiAppEmpty from '~/components/ui/AppEmpty.vue'
import { useCategories } from '~/composables/useCategories'
import useDishCounts from '~/composables/useDishCounts'

const props = defineProps<{
  tenantId: string
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [id: string | null]
  'categoriesLoaded': [cats: Category[]]
}>()

const tenantIdRef = computed(() => props.tenantId)

const { categories, loading: categoriesLoading, add: addCategory, update: updateCategory, remove: removeCategory }
  = useCategories(tenantIdRef)

watch(categories, (cats) => emit('categoriesLoaded', cats), { immediate: true })

const { counts: dishCountByCategory } = useDishCounts(tenantIdRef)

const { confirm } = useConfirm()

const categoryModalOpen = ref(false)
const editingCategory = ref<Category | null>(null)
const categoryForm = reactive({ name: '' })
const saving = ref(false)

const openCategoryModal = (cat: Category | null) => {
  editingCategory.value = cat
  categoryForm.name = cat?.name ?? ''
  categoryModalOpen.value = true
}

const saveCategory = async () => {
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

const confirmDeleteCategory = async (id: string) => {
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
  background: var(--color-bg-card);
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
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.panel-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-title);
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
    background: var(--color-bg-hover);

    .cat-actions {
      opacity: 1;
    }
  }

  &.selected {
    background: var(--color-primary-light);
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
  color: var(--color-title);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-count {
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg-page);
  border-radius: 6px;
  padding: 1px 6px;
}

.cat-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
