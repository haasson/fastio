<template>
  <div class="categories-root">
    <UiSectionHeader label="Категории">
      <UiButton
        size="small"
        type="default"
        icon="plus"
        @click="openCategoryModal(null)"
      >Добавить</UiButton>
    </UiSectionHeader>

    <UiSkeleton
      v-if="categoriesLoading"
      text
      :repeat="3"
      class="skeleton"
    />

    <div v-else class="bar">
      <div
        v-for="cat in categories"
        :key="cat.id"
        class="tag"
        :class="{ selected: modelValue === cat.id, inactive: !cat.active }"
        @click="$emit('update:modelValue', cat.id)"
      >
        <span class="tag-name">{{ cat.name }}</span>
        <span class="tag-count">{{ dishCountByCategory[cat.id] ?? 0 }}</span>
        <div class="tag-actions" @click.stop>
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
      </div>
    </div>

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
            <UiButton type="default" @click="categoryModalOpen = false">Отмена</UiButton>
            <UiButton type="primary" :loading="saving" @click="saveCategory">Сохранить</UiButton>
          </UiSpace>
        </div>
      </UiSpace>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { UiModal, UiInput, UiButton, UiSkeleton, UiSpace, useConfirm } from '@fastio/ui'
import type { Category } from '@fastio/shared'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
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
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton {
  padding: 0;
}

.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 20px;
  cursor: pointer;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  transition: background 0.12s;
  user-select: none;

  &:hover {
    background: var(--color-bg-hover);

    .tag-actions {
      opacity: 1;
      width: auto;
      margin-left: 2px;
    }
  }

  &.selected {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
  }

  &.inactive .tag-name {
    opacity: 0.45;
    text-decoration: line-through;
  }
}

.tag-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-title);
  white-space: nowrap;
}

.tag-count {
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg-page);
  border-radius: 6px;
  padding: 1px 5px;
  white-space: nowrap;
}

.tag-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  width: 0;
  overflow: hidden;
  transition: opacity 0.15s, width 0.15s;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
