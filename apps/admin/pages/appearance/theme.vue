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
        :style="{
          '--p-bg': preset.palette.bg,
          '--p-surface': preset.palette.surface,
          '--p-primary': preset.palette.primary,
          '--p-text': preset.palette.text,
          '--p-muted': preset.palette.textMuted,
          '--p-border': preset.palette.border,
        }"
        @click="selectPreset(preset.value)"
      >
        <span class="mini">
          <span class="mini-header">
            <span class="mini-logo" />
            <span class="mini-spacer" />
            <span class="mini-btn" />
          </span>
          <span class="mini-hero">
            <span class="mini-line" />
            <span class="mini-line mini-line--short" />
          </span>
          <span class="mini-cards">
            <span class="mini-card" />
            <span class="mini-card" />
            <span class="mini-card" />
          </span>
        </span>
        <span class="preset-name">{{ preset.label }}</span>
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

    <template v-if="themeForm.palette">
      <div class="divider" />
      <div class="section-label">Цвета</div>
      <div class="palette-grid">
        <div v-for="item in paletteItems" :key="item.key" class="palette-item">
          <input
            type="color"
            class="palette-input"
            :value="themeForm.palette![item.key]"
            @input="onPaletteColor(item.key, ($event.target as HTMLInputElement).value)"
          />
          <span class="palette-label">{{ item.label }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { UiSelect, UiInputNumber, UiRadioGroup, UiSegmentedControl } from '@fastio/ui'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import { themePresets, fontOptions } from '~/config/theme-presets'
import { AppearanceFormKey } from '~/composables/data/useAppearanceForm'
import { getPresetPalette } from '@fastio/shared'
import type { TenantThemePreset, ThemePalette } from '@fastio/shared'

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

const paletteItems: { key: keyof ThemePalette; label: string }[] = [
  { key: 'primary', label: 'Акцент' },
  { key: 'bg', label: 'Фон' },
  { key: 'surface', label: 'Поверхность' },
  { key: 'text', label: 'Текст' },
  { key: 'textSecondary', label: 'Текст 2' },
  { key: 'textMuted', label: 'Приглушённый' },
  { key: 'border', label: 'Граница' },
]

const selectPreset = (value: TenantThemePreset) => {
  themeForm.preset = value
  const palette = getPresetPalette(value)

  if (palette) themeForm.palette = { ...palette }
  themeForm.primaryColor = themeForm.palette?.primary ?? themeForm.primaryColor
}

const onPaletteColor = (key: keyof ThemePalette, value: string) => {
  if (!themeForm.palette) return
  themeForm.palette[key] = value
  themeForm.preset = 'custom'
  if (key === 'primary') themeForm.primaryColor = value
}
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
  gap: 8px;
  padding: 8px;
  border: 2px solid var(--p-border);
  border-radius: 12px;
  background: var(--p-bg);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover {
    box-shadow: 0 0 0 1px var(--p-primary);
  }

  &.selected {
    border-color: var(--p-primary);
    box-shadow: 0 0 0 1px var(--p-primary);
  }
}

.mini {
  display: flex;
  flex-direction: column;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--p-border);
  background: var(--p-bg);
  width: 100%;
  pointer-events: none;
}

.mini-header {
  background: var(--p-surface);
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px 6px;
  border-bottom: 1px solid var(--p-border);
}

.mini-logo {
  width: 14px;
  height: 5px;
  border-radius: 2px;
  background: var(--p-muted);
  flex-shrink: 0;
}

.mini-spacer {
  flex: 1;
}

.mini-btn {
  width: 16px;
  height: 7px;
  border-radius: 2px;
  background: var(--p-primary);
  flex-shrink: 0;
}

.mini-hero {
  background: var(--p-bg);
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-bottom: 1px solid var(--p-border);
}

.mini-line {
  height: 4px;
  border-radius: 2px;
  background: var(--p-text);
  width: 75%;
  opacity: 0.5;

  &--short {
    width: 45%;
    opacity: 0.3;
  }
}

.mini-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 6px;
  background: var(--p-bg);
}

.mini-card {
  height: 18px;
  border-radius: 3px;
  background: var(--p-surface);
  border: 1px solid var(--p-border);
}

.preset-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text);
  opacity: 0.7;
  text-align: center;
  padding-bottom: 2px;
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

.divider {
  height: 1px;
  background: var(--color-border);
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-hint);
}

.palette-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.palette-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.palette-input {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1.5px solid var(--color-border);
  padding: 2px;
  cursor: pointer;
  background: none;
  overflow: hidden;
}

.palette-label {
  font-size: 10px;
  color: var(--color-text-hint);
  text-align: center;
}
</style>
