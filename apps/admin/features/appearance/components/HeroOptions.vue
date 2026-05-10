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
      </div>

      <div class="col">
        <div class="field">
          <label class="label">Фон</label>
          <UiRadioGroup v-model="form.bgType" :options="bgTypeOptions" />
          <div v-if="form.bgType === 'image'" class="photo-wrap">
            <ImageUploadTrigger
              :model-value="heroContent.bgUrl"
              aspect-ratio="3:1"
              modal-title="Фон хиро"
              @update:model-value="heroContent.bgUrl = $event ?? null"
              @pending="onPendingHeroBg"
            />
          </div>
          <GradientPicker v-if="form.bgType === 'gradient'" v-model="form.gradientId" :palette="palette" />
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

    <div class="field">
      <label class="label">Текст</label>
      <RichTextEditor
        :model-value="heroContent.text ?? ''"
        hero
        @update:model-value="heroContent.text = $event"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch, nextTick, inject, computed, toRefs } from 'vue'
import { UiSegmentedControl, UiRadioGroup } from '@fastio/ui'
import ContentPositionPicker from './ContentPositionPicker.vue'
import GradientPicker from './GradientPicker.vue'
import ImageUploadTrigger from '~/components/ui/ImageUploadTrigger.vue'
import RichTextEditor from '~/components/ui/RichTextEditor.vue'
import type { SiteLayout, SiteContent } from '@fastio/shared'
import { AppearanceFormKey } from '../composables/useAppearanceForm'

type HeroConfig = SiteLayout['sections']['hero']

const props = defineProps<{
  modelValue: HeroConfig
  heroContent: SiteContent['hero']
  onPendingHeroBg: (file: File | null) => void
}>()
const emit = defineEmits<{ 'update:modelValue': [value: HeroConfig] }>()

const { heroContent, onPendingHeroBg } = toRefs(props)

const appearanceForm = inject(AppearanceFormKey)
const palette = computed(() => appearanceForm?.themeForm.palette ?? null)

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
  { value: 'gradient', label: 'Градиент' },
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
  gap: var(--space-12);
}

.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-24);
  align-items: start;
}

.col {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-hint);
}

.color-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.color-picker {
  width: 42px;
  height: 42px;
  border: none;
  border-radius: var(--radius-8);
  padding: var(--space-4);
  cursor: pointer;
  flex-shrink: 0;
}

.color-value {
  font-size: var(--font-size-base);
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
