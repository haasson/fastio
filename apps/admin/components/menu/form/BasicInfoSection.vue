<template>
  <div class="basic-info-section-root">
    <div class="col-photo">
      <UiText size="tiny" span class="section-title">Фото</UiText>
      <ImageUploadTrigger
        :model-value="photoUrl"
        aspect-ratio="4:3"
        @update:model-value="$emit('update:photoUrl', $event); $emit('update:photoRemoved', !$event)"
        @pending="$emit('update:pendingPhoto', $event)"
      />
    </div>

    <div class="col-main">
      <UiText size="tiny" span class="section-title">Основное</UiText>

      <div class="row">
        <UiInput
          :model-value="name"
          name="name"
          label="Название *"
          :placeholder="namePlaceholder"
          :rules="[{ type: 'required', message: 'Введите название' }]"
          @update:model-value="$emit('update:name', $event)"
        />
        <UiInputNumber
          :model-value="price"
          name="price"
          label="Цена, ₽ *"
          :min="0"
          :placeholder="String(pricePlaceholder ?? 0)"
          :rules="[{ type: 'required', message: 'Введите цену' }]"
          @update:model-value="$emit('update:price', $event)"
        />
      </div>

      <UiInput
        :model-value="description"
        label="Описание"
        type="textarea"
        :rows="2"
        :placeholder="descriptionPlaceholder"
        @update:model-value="$emit('update:description', $event)"
      />

      <UiSelect
        v-if="categoryOptions && categoryOptions.length > 1"
        :value="categoryId"
        label="Категория"
        :options="categoryOptions"
        @update:value="$emit('update:categoryId', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiText, UiInput, UiInputNumber, UiSelect } from '@fastio/ui'
import ImageUploadTrigger from '~/components/ui/ImageUploadTrigger.vue'

defineProps<{
  photoUrl: string | null
  name: string
  price: number | null
  description: string
  namePlaceholder?: string
  pricePlaceholder?: number
  descriptionPlaceholder?: string
  categoryId?: string
  categoryOptions?: { label: string; value: string }[]
}>()

defineEmits<{
  'update:photoUrl': [value: string | null]
  'update:photoRemoved': [value: boolean]
  'update:pendingPhoto': [value: File | null]
  'update:name': [value: string]
  'update:price': [value: number | null]
  'update:description': [value: string]
  'update:categoryId': [value: string]
}>()
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;
@use '@fastio/styles/mixins/form' as *;

.basic-info-section-root {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;

  @include mq-m {
    grid-template-columns: 200px 1fr;
    gap: 24px;
  }
}

.section-title {
  @include section-title;
  padding-top: 4px;
}

.col-photo,
.col-main {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;

  @include mq-m {
    grid-template-columns: 1fr 120px;
  }
}
</style>
