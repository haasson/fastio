<template>
  <div class="hero-options-root">
    <div class="field">
      <label class="label">Размер хиро</label>
      <UiSegmentedControl v-model="form.size" :items="sizeOptions" />
    </div>

    <div class="cols">
      <div class="col">
        <div class="field">
          <label class="label">Позиция контента</label>
          <ContentPositionPicker v-model="form.contentPosition" />
        </div>

        <div class="field">
          <label class="label">Выравнивание текста</label>
          <UiSegmentedControl v-model="form.contentAlign" :items="alignOptions" />
        </div>

        <div class="field">
          <label class="label">Текст</label>
          <RichTextEditor :model-value="heroContent.text ?? ''" @update:model-value="heroContent.text = $event" />
        </div>
      </div>

      <div class="col">
        <div class="field">
          <label class="label">Фон</label>
          <UiRadioGroup v-model="form.bgType" :options="bgTypeOptions" />
          <div v-if="form.bgType !== 'none'" class="photo-wrap">
            <PhotoUpload
              :model-value="heroContent.bgUrl"
              @update:model-value="heroContent.bgUrl = $event ?? null"
              @pending="props.onPendingHeroBg"
            />
          </div>
        </div>

        <div class="field">
          <label class="label">Оверлей</label>
          <div class="color-row">
            <input v-model="form.overlayColor" type="color" class="color-picker" />
            <span class="color-value">{{ form.overlayColor }}</span>
          </div>
          <label class="label">Прозрачность: {{ Math.round(form.overlayOpacity * 100) }}%</label>
          <input
            v-model.number="form.overlayOpacity"
            type="range"
            min="0"
            max="1"
            step="0.05"
            class="range"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch, nextTick } from 'vue'
import { UiSegmentedControl, UiRadioGroup } from '@fastio/ui'
import ContentPositionPicker from './ContentPositionPicker.vue'
import PhotoUpload from '~/components/ui/PhotoUpload.vue'
import RichTextEditor from '~/components/ui/RichTextEditor.vue'
import type { SiteLayout, SiteContent } from '@fastio/shared'

type HeroConfig = SiteLayout['sections']['hero']

const props = defineProps<{
  modelValue: HeroConfig
  heroContent: SiteContent['hero']
  onPendingHeroBg: (file: File | null) => void
}>()
const emit = defineEmits<{ 'update:modelValue': [value: HeroConfig] }>()

const heroContent = props.heroContent

const sizeOptions = [
  { value: 'fullscreen', label: 'На весь экран' },
  { value: 'content', label: 'Компактный' },
]

const alignOptions = [
  { value: 'left', label: 'Лево' },
  { value: 'center', label: 'Центр' },
  { value: 'right', label: 'Право' },
]

const bgTypeOptions = [
  { value: 'none', label: 'Без фона' },
  { value: 'image', label: 'Изображение' },
]

const form = reactive<HeroConfig>({ ...props.modelValue })

let isUpdatingFromParent = false

watch(() => props.modelValue, (v) => {
  isUpdatingFromParent = true
  Object.assign(form, v)
  nextTick(() => {
    isUpdatingFromParent = false
  })
}, { deep: true })
watch(form, () => {
  if (!isUpdatingFromParent) emit('update:modelValue', { ...form })
})
</script>

<style scoped lang="scss">
.hero-options-root {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: start;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-hint);
}

.color-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-picker {
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 10px;
  padding: 2px;
  cursor: pointer;
  flex-shrink: 0;
}

.color-value {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-family: monospace;
}

.range {
  width: 100%;
  cursor: pointer;
}

.photo-wrap {
  max-width: 180px;
}
</style>
