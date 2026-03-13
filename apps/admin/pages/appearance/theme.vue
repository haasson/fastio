<template>
  <div class="form">
    <UiSectionHeader title="Тема оформления" />

    <div class="presets">
      <button
        v-for="preset in presets"
        :key="preset.value"
        type="button"
        class="preset"
        :class="{ selected: themeForm.preset === preset.value }"
        :style="{ '--preset-color': preset.preview }"
        @click="themeForm.preset = preset.value"
      >
        <span class="preset-swatch" />
        <span class="preset-name">{{ preset.label }}</span>
        <span v-if="themeForm.preset === preset.value" class="preset-check">✓</span>
      </button>
    </div>

    <UiSelect v-model:value="themeForm.fontFamily" :options="fontOptions" label="Шрифт" />

    <div class="field">
      <label class="label">Стиль кнопок</label>
      <UiSegmentedControl
        v-model="themeForm.buttonRadius"
        :items="buttonRadiusOptions"
      />
    </div>

    <UiInputNumber
      v-model="themeForm.cardRadius"
      label="Радиус карточек (px)"
      :min="8"
      :max="24"
      :show-button="true"
    />

    <div class="field">
      <label class="label">Тени карточек</label>
      <UiRadioGroup
        v-model="themeForm.cardShadow"
        :options="cardShadowOptions"
      />
    </div>

  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { UiSelect, UiInputNumber, UiRadioGroup, UiSegmentedControl } from '@fastio/ui'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import { themePresets, fontOptions } from '~/config/theme-presets'
import { AppearanceFormKey } from '~/composables/data/useAppearanceForm'

const form = inject(AppearanceFormKey)!
const themeForm = form.themeForm

const presets = themePresets

const buttonRadiusOptions = [
  { value: 'square', label: 'Квадратные' },
  { value: 'rounded', label: 'Скруглённые' },
  { value: 'pill', label: 'Пилюля' },
]

const cardShadowOptions = [
  { value: 'none', label: 'Без теней' },
  { value: 'subtle', label: 'Лёгкие' },
  { value: 'medium', label: 'Средние' },
]
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/form' as *;
@use '@fastio/styles/mixins/media-queries' as *;

.form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.presets {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;

  @include mq-m {
    grid-template-columns: repeat(4, 1fr);
  }
}

.preset {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border: 2px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-card);
  cursor: pointer;
  transition: border-color 0.15s;
  position: relative;

  &:hover {
    border-color: var(--color-text-tertiary);
  }

  &.selected {
    border-color: var(--color-primary);
  }
}

.preset-swatch {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--preset-color);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.preset-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-hint);
}

.preset-check {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 11px;
  color: var(--color-primary);
  font-weight: 800;
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

</style>
