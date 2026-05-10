<template>
  <UiModal
    :model-value="modelValue"
    :title="gallery ? 'Редактировать галерею' : 'Новая галерея'"
    :width="520"
    :actions="modalActions"
    :loading="saving"
    :on-confirm="onConfirm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <UiForm ref="formRef">
      <UiInput
        v-model="form.name"
        name="name"
        label="Название (внутреннее)"
        placeholder="Например: Интерьер"
        :rules="[{ type: 'required', message: 'Введите название' }]"
      />

      <UiInput
        v-model="form.title"
        label="Заголовок (на сайте)"
        placeholder="Наши фото"
      />

      <UiInput
        v-model="form.description"
        label="Описание"
        placeholder="Краткое описание галереи"
      />

      <UiCheckbox v-model:checked="form.autoplay">Автоперелистывание</UiCheckbox>

      <div v-if="form.autoplay" class="interval-row">
        <label class="field-label">Интервал (сек)</label>
        <UiInputNumber
          v-model:value="form.autoplayInterval"
          :min="1"
          :max="30"
          :step="1"
          :show-button="true"
          style="width: 100px"
        />
      </div>
    </UiForm>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiModal, UiForm, UiInput, UiCheckbox, UiInputNumber } from '@fastio/ui'
import type { ModalAction } from '@fastio/ui'
import type { Gallery, GalleryFormData } from '@fastio/shared'

const props = defineProps<{
  modelValue: boolean
  gallery: Gallery | null
  saving: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [data: GalleryFormData]
}>()

const formRef = ref<InstanceType<typeof UiForm> | null>(null)

const form = ref<GalleryFormData>({
  name: '',
  title: null,
  description: null,
  autoplay: false,
  autoplayInterval: 4,
})

watch(() => props.modelValue, (open) => {
  if (!open) return
  const g = props.gallery

  form.value = {
    name: g?.name ?? '',
    title: g?.title ?? null,
    description: g?.description ?? null,
    autoplay: g?.autoplay ?? false,
    autoplayInterval: g?.autoplayInterval ?? 4,
  }
}, { immediate: true })

const modalActions = computed((): ModalAction[] => [
  { text: 'Отмена', type: 'default', actionType: 'decline' },
  { text: props.gallery ? 'Сохранить' : 'Создать', type: 'primary', actionType: 'confirm', loading: props.saving },
])

const onConfirm = () => {
  if (!formRef.value?.validate()) return false
  emit('save', { ...form.value, name: form.value.name.trim() })
}
</script>

<style scoped lang="scss">
.interval-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.field-label {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}
</style>
