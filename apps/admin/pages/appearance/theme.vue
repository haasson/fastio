<template>
  <div class="form">
    <UiSectionHeader title="Оформление" />

    <!-- Пресеты -->
    <div class="group">
      <div class="presets-header">
        <UiSegmentedControl v-model="category" :items="categoryOptions" />
        <div v-if="showNav" class="page-nav">
          <button class="nav-btn" :disabled="page === 0" @click="page--">
            <UiIcon name="chevronLeft" :size="16" />
          </button>
          <button class="nav-btn" :disabled="page >= maxPage" @click="page++">
            <UiIcon name="chevronRight" :size="16" />
          </button>
        </div>
      </div>
      <div class="presets">
        <button
          v-for="preset in visiblePresets"
          :key="preset.value"
          type="button"
          class="theme-card"
          :class="{ active: themeForm.preset === preset.value && !themeForm.activeCustomId }"
          :style="{
            '--p-bg': preset.palette.bg,
            '--p-surface': preset.palette.surface,
            '--p-primary': preset.palette.primary,
            '--p-text': preset.palette.text,
            '--p-muted': preset.palette.textMuted,
            '--p-border': preset.palette.border,
          }"
          @click="activatePreset(preset.value)"
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
          <span class="card-name">{{ preset.label }}</span>
        </button>
      </div>
    </div>

    <div class="divider" />

    <div class="field">
      <UiSelect
        v-model:value="themeForm.fontFamily"
        :options="fontOptions"
        :render-label="renderFontLabel"
        label="Шрифт текста"
        filterable
      />
      <div v-if="fontPreviewStyle" class="font-preview" :style="fontPreviewStyle">
        Быстрая лиса прыгает — The quick brown fox
      </div>
    </div>

    <div class="field">
      <UiSelect
        v-model:value="themeForm.headingFontFamily"
        :options="fontOptions"
        :render-label="renderFontLabel"
        label="Шрифт заголовков"
        filterable
      />
      <div v-if="headingFontPreviewStyle" class="font-preview font-preview--heading" :style="headingFontPreviewStyle">
        Быстрая лиса прыгает — The quick brown fox
      </div>
    </div>

    <div class="field">
      <label class="label">Стиль кнопок</label>
      <UiSegmentedControl v-model="themeForm.buttonRadius" :items="buttonRadiusOptions" />
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
      <UiRadioGroup v-model="themeForm.cardShadow" :options="cardShadowOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { UiSelect, UiInputNumber, UiRadioGroup, UiSegmentedControl, UiIcon, UiSectionHeader } from '@fastio/ui'
import type { SelectOption } from 'naive-ui'
import { themePresets, fontOptions } from '~/config/theme-presets'
import { GOOGLE_FONTS, isGoogleFontValue, fontFamilyCSS, googleFontsBatchUrl } from '~/config/google-fonts'
import { AppearanceFormKey } from '~/composables/data/useAppearanceForm'
import { getPresetPalette } from '@fastio/shared'
import type { TenantThemePreset } from '@fastio/shared'

const form = inject(AppearanceFormKey)!
const themeForm = form.themeForm
const presets = themePresets

// ─── font loading ─────────────────────────────────────────────────────────────

const batchFontLink = ref<ReturnType<typeof document.createElement> | null>(null)

onMounted(() => {
  const families = GOOGLE_FONTS.map((f) => f.family)
  const link = document.createElement('link')

  link.rel = 'stylesheet'
  link.href = googleFontsBatchUrl(families, '400')
  document.head.appendChild(link)
  batchFontLink.value = link
})

onUnmounted(() => {
  batchFontLink.value?.remove()
})

// ─── font preview ─────────────────────────────────────────────────────────────

const fontPreviewStyle = computed(() => {
  const value = themeForm.fontFamily

  if (!value || !isGoogleFontValue(value)) return null

  return { fontFamily: fontFamilyCSS(value) }
})

const headingFontPreviewStyle = computed(() => {
  const value = themeForm.headingFontFamily

  if (!value || !isGoogleFontValue(value)) return null

  return { fontFamily: fontFamilyCSS(value) }
})

// ─── font select render ───────────────────────────────────────────────────────

const renderFontLabel = (option: SelectOption) => {
  const value = option.value as string

  if (!value || !isGoogleFontValue(value)) return option.label as string

  return h('span', { style: { fontFamily: fontFamilyCSS(value) } }, option.label as string)
}

// ─── preset activation ────────────────────────────────────────────────────────

const activatePreset = (name: TenantThemePreset) => {
  const palette = getPresetPalette(name)!

  themeForm.preset = name
  themeForm.palette = { ...palette }
  themeForm.primaryColor = palette.primary
  themeForm.activeCustomId = null
}

// ─── light / dark categorization ─────────────────────────────────────────────

const bgLuminance = (hex: string): number => {
  const n = parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255

    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const isPresetDark = (palette: { bg: string }) => bgLuminance(palette.bg) <= 0.25

const lightPresets = presets.filter((p) => !isPresetDark(p.palette))
const darkPresets = presets.filter((p) => isPresetDark(p.palette))

const getCategory = (presetName: string): 'light' | 'dark' => {
  const p = presets.find((p) => p.value === presetName)

  return p && isPresetDark(p.palette) ? 'dark' : 'light'
}

// ─── carousel ─────────────────────────────────────────────────────────────────

const PER_PAGE = 8 // 2 rows × 4 cols

const categoryOptions = [
  { value: 'light', label: 'Светлые' },
  { value: 'dark', label: 'Тёмные' },
]

const category = ref<'light' | 'dark'>(getCategory(themeForm.preset))
const page = ref(0)

const currentPresets = computed(() => category.value === 'light' ? lightPresets : darkPresets)
const maxPage = computed(() => Math.max(0, Math.ceil(currentPresets.value.length / PER_PAGE) - 1))
const visiblePresets = computed(() => currentPresets.value.slice(page.value * PER_PAGE, (page.value + 1) * PER_PAGE))
const showNav = computed(() => maxPage.value > 0)

watch(category, () => {
  page.value = 0
})

// ─── options ─────────────────────────────────────────────────────────────────

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
@use '@fastio/styles/mixins/media-queries' as *;

.form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.presets-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.page-nav {
  display: flex;
  gap: 4px;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    background: var(--color-bg-hover);
    border-color: var(--color-text-hint);
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
}

.presets {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;

  @include mq-m {
    grid-template-columns: repeat(4, 1fr);
  }
}

// ─── theme card ───────────────────────────────────────────────────────────────

.theme-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  border: 2px solid var(--p-border, var(--color-border));
  border-radius: 10px;
  background: var(--p-bg, var(--color-bg));
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  position: relative;

  &:hover {
    box-shadow: 0 0 0 1px var(--p-primary, var(--color-primary));
  }

  &.active {
    border-color: var(--p-primary);
    box-shadow: 0 0 0 1px var(--p-primary);
  }
}

.card-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--p-text, var(--color-text));
  opacity: 0.65;
  text-align: center;
  line-height: 1.2;
}

// ─── mini wireframe ───────────────────────────────────────────────────────────

.mini {
  display: flex;
  flex-direction: column;
  border-radius: 4px;
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
  padding: 4px 5px;
  border-bottom: 1px solid var(--p-border);
}

.mini-logo {
  width: 12px;
  height: 4px;
  border-radius: 2px;
  background: var(--p-muted);
  flex-shrink: 0;
}

.mini-spacer { flex: 1; }

.mini-btn {
  width: 14px;
  height: 6px;
  border-radius: 2px;
  background: var(--p-primary);
  flex-shrink: 0;
}

.mini-hero {
  background: var(--p-bg);
  padding: 6px 5px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  border-bottom: 1px solid var(--p-border);
}

.mini-line {
  height: 3px;
  border-radius: 2px;
  background: var(--p-text);
  width: 70%;
  opacity: 0.4;

  &--short { width: 45%; opacity: 0.25; }
}

.mini-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  padding: 5px;
}

.mini-card {
  height: 14px;
  border-radius: 2px;
  background: var(--p-surface);
  border: 1px solid var(--p-border);
}

// ─── misc ─────────────────────────────────────────────────────────────────────

.font-preview {
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 15px;
  color: var(--color-text-secondary);
  background: var(--color-bg-card);

  &--heading {
    font-size: 20px;
    font-weight: 700;
  }
}

.divider {
  height: 1px;
  background: var(--color-border);
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
