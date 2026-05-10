<template>
  <div class="basic-info-section-root">
    <div class="col-photo" data-tour="dish-photo">
      <UiText size="tiny" span class="section-title">Фото</UiText>
      <ImageUploadTrigger
        :model-value="photoUrl"
        aspect-ratio="1:1"
        @update:model-value="$emit('update:photoUrl', $event); $emit('update:photoRemoved', !$event)"
        @pending="$emit('update:pendingPhoto', $event)"
      />
    </div>

    <div class="col-main" data-tour="dish-main-fields">
      <UiText size="tiny" span class="section-title">Основное</UiText>

      <div class="row">
        <UiInput
          :model-value="name"
          name="name"
          label="Название *"
          :placeholder="namePlaceholder"
          :rules="[{ type: 'required', message: 'Введите название' }]"
          @update:model-value="$emit('update:name', $event ?? '')"
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
        @update:model-value="$emit('update:description', $event ?? '')"
      />

      <template v-if="showLongDescriptionOption">
        <UiCheckbox
          :checked="showLongDescription"
          @update:checked="$emit('update:showLongDescription', $event)"
        >
          Подробное описание
        </UiCheckbox>

        <UiInput
          v-if="showLongDescription"
          :model-value="longDescription"
          label="Подробное описание"
          type="textarea"
          :rows="5"
          @update:model-value="$emit('update:longDescription', $event ?? '')"
        />
      </template>

      <div class="category-row">
        <UiSelect
          v-if="categoryOptions && categoryOptions.length > 1"
          :value="categoryId"
          label="Категория"
          :options="categoryOptions"
          class="category-select"
          @update:value="$emit('update:categoryId', $event)"
        />
        <div v-if="showWeight !== false" class="weight-group">
          <UiInputNumber
            :model-value="weight"
            :label="weightUnit === 'мл' ? 'Объём, мл' : 'Вес, г'"
            :min="0"
            :show-button="true"
            :placeholder="weightUnit === 'мл' ? '400' : '350'"
            class="weight-input"
            @update:model-value="$emit('update:weight', $event)"
          />
          <UiSegmentedControl
            :model-value="weightUnit"
            size="small"
            :items="unitItems"
            class="unit-control"
            @update:model-value="$emit('update:weightUnit', $event as 'г' | 'мл')"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiText, UiInput, UiInputNumber, UiSelect, UiSegmentedControl, UiCheckbox } from '@fastio/ui'
import ImageUploadTrigger from '~/components/ui/ImageUploadTrigger.vue'

const unitItems = [
  { label: 'г', value: 'г' },
  { label: 'мл', value: 'мл' },
]

withDefaults(defineProps<{
  photoUrl: string | null
  name: string
  price: number | null
  description: string
  weight?: number | null
  weightUnit?: 'г' | 'мл'
  namePlaceholder?: string
  pricePlaceholder?: number
  descriptionPlaceholder?: string
  categoryId?: string
  categoryOptions?: { label: string; value: string }[]
  showWeight?: boolean
  longDescription?: string
  showLongDescription?: boolean
  showLongDescriptionOption?: boolean
}>(), {
  showLongDescriptionOption: true,
})

defineEmits<{
  'update:photoUrl': [value: string | null]
  'update:photoRemoved': [value: boolean]
  'update:pendingPhoto': [value: File | null]
  'update:name': [value: string]
  'update:price': [value: number | null]
  'update:description': [value: string]
  'update:categoryId': [value: string | number | (string | number)[] | null]
  'update:weight': [value: number | null]
  'update:weightUnit': [value: 'г' | 'мл']
  'update:longDescription': [value: string]
  'update:showLongDescription': [value: boolean]
}>()
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;
@use '@fastio/styles/mixins/form' as *;

.basic-info-section-root {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-12);

  @include mq-m {
    grid-template-columns: 200px 1fr;
    gap: var(--space-24);
  }
}

.section-title {
  @include section-title;
  padding-top: var(--space-4);
}

.col-photo,
.col-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.row {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-8);

  @include mq-m {
    grid-template-columns: 1fr 120px;
  }
}

.category-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-8);
}

.category-select {
  flex: 1;
  min-width: 0;
}

.weight-group {
  display: flex;
  align-items: flex-end;
  gap: var(--space-8);
  flex-shrink: 0;
}

.weight-input {
  width: 90px;
}

</style>
