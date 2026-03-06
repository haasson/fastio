<template>
  <div class="categories-root">
    <UiSectionHeader label="Категории" />

    <UiSkeleton
      v-if="categoriesLoading"
      text
      :repeat="3"
      class="skeleton"
    />

    <UiTabs
      v-else
      :model-value="modelValue ?? ''"
      :tabs="categoryTabs"
      @update:model-value="$emit('update:modelValue', String($event))"
    />

    <UiModal
      v-model="categoryModalOpen"
      :title="editingCategory ? 'Редактировать категорию' : 'Новая категория'"
      :width="500"
      :actions="modalActions"
      :on-confirm="onConfirm"
    >
      <UiForm ref="formRef" class="form">
        <UiInput
          v-model="categoryForm.name"
          name="name"
          label="Название"
          placeholder="Например: Пицца"
          autofocus
          :rules="[{ type: 'required', message: 'Введите название' }]"
        />

        <UiCheckbox v-if="editingCategory" v-model="categoryForm.active">
          Категория активна
        </UiCheckbox>

        <UiCheckbox v-model="categoryForm.useFirstDishPhoto">
          Использовать картинку первого блюда
        </UiCheckbox>

        <DishPhotoUpload
          v-if="!categoryForm.useFirstDishPhoto"
          v-model="currentPhotoUrl"
          @pending="pendingPhotoFile = $event"
        />
      </UiForm>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { UiModal, UiForm, UiInput, UiSkeleton, UiCheckbox, UiTabs, useConfirm } from '@fastio/ui'
import type { Category } from '@fastio/shared'
import { useNuxtApp } from '#imports'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import DishPhotoUpload from '~/components/menu/DishPhotoUpload.vue'
import { useCategories } from '~/composables/useCategories'
import useDishCounts from '~/composables/useDishCounts'
import { categoriesApi } from '~/utils/api/categories'

const props = defineProps<{
  tenantId: string
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [id: string | null]
  'categoriesLoaded': [cats: Category[]]
}>()

const { $supabase: sb } = useNuxtApp()
const tenantIdRef = computed(() => props.tenantId)

const { categories, loading: categoriesLoading, add: addCategory, update: updateCategory, remove: removeCategory }
  = useCategories(tenantIdRef)

watch(categories, (cats) => emit('categoriesLoaded', cats), { immediate: true })

const { counts: dishCountByCategory } = useDishCounts(tenantIdRef)

const categoryTabs = computed(() => categories.value.map((c) => ({
  value: c.id,
  label: c.name,
  count: dishCountByCategory.value[c.id] ?? 0,
})),
)

const { confirm } = useConfirm()

const formRef = ref()
const categoryModalOpen = ref(false)
const editingCategory = ref<Category | null>(null)
const categoryForm = reactive({ name: '', useFirstDishPhoto: false, active: true })
const currentPhotoUrl = ref<string | null>(null)
const originalPhotoUrl = ref<string | null>(null)
const pendingPhotoFile = ref<File | null>(null)
const saving = ref(false)

const modalActions = computed(() => [
  { text: 'Отмена', type: 'default' as const, actionType: 'decline' as const },
  { text: 'Сохранить', type: 'primary' as const, actionType: 'confirm' as const, loading: saving.value },
])

const openCategoryModal = (cat: Category | null) => {
  editingCategory.value = cat
  categoryForm.name = cat?.name ?? ''
  categoryForm.active = cat?.active ?? true
  categoryForm.useFirstDishPhoto = cat?.useFirstDishPhoto ?? false
  originalPhotoUrl.value = cat?.photoUrl ?? null
  currentPhotoUrl.value = cat?.photoUrl ?? null
  pendingPhotoFile.value = null
  categoryModalOpen.value = true
}

const onConfirm = async () => {
  if (!formRef.value?.validate()) return false

  saving.value = true
  try {
    let photoUrl = currentPhotoUrl.value

    if (pendingPhotoFile.value) {
      if (originalPhotoUrl.value) {
        await categoriesApi.deletePhoto(sb, originalPhotoUrl.value)
      }
      photoUrl = await categoriesApi.uploadPhoto(sb, props.tenantId, pendingPhotoFile.value)
    } else if (currentPhotoUrl.value === null && originalPhotoUrl.value) {
      await categoriesApi.deletePhoto(sb, originalPhotoUrl.value)
    }

    const photoData = categoryForm.useFirstDishPhoto
      ? { photoUrl: null, useFirstDishPhoto: true }
      : { photoUrl, useFirstDishPhoto: false }

    if (editingCategory.value) {
      await updateCategory(editingCategory.value.id, { name: categoryForm.name, active: categoryForm.active, ...photoData })
    } else {
      await addCategory(categoryForm.name, photoData)
    }
  } catch {
    return false
  } finally {
    saving.value = false
  }
}

const confirmDeleteCategory = async (id: string) => {
  const hasDishes = (dishCountByCategory.value[id] ?? 0) > 0
  const ok = await confirm({
    title: 'Удалить категорию?',
    confirmText: 'Удалить',
    confirmType: 'error',
    ...(hasDishes && {
      alert: 'Сначала удалите или перенесите все блюда из этой категории',
      confirmDisabled: true,
    }),
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
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--color-border);
}

.skeleton {
  padding: 0;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
