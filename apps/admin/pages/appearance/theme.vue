<template>
  <div class="form">
    <UiSectionHeader title="Оформление" />

    <!-- Пресеты -->
    <div class="group">
      <div class="group-label">Пресеты</div>
      <div class="presets">
        <button
          v-for="preset in presets"
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

    <!-- Мои темы -->
    <div class="group">
      <div class="group-label">Мои темы</div>
      <div class="presets">
        <div
          v-for="ct in themeForm.customThemes"
          :key="ct.id"
          class="theme-card theme-card--custom"
          :class="{
            active: themeForm.activeCustomId === ct.id,
            editing: editing?.id === ct.id,
          }"
          :style="{
            '--p-bg': ct.palette.bg,
            '--p-surface': ct.palette.surface,
            '--p-primary': ct.palette.primary,
            '--p-text': ct.palette.text,
            '--p-muted': ct.palette.textMuted,
            '--p-border': ct.palette.border,
          }"
          @click="openEdit(ct.id)"
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
          <span class="card-name">{{ ct.name }}</span>
          <span class="card-active-dot" />
        </div>

        <button type="button" class="theme-card theme-card--new" @click="openCreate(themeForm.preset)">
          <UiIcon name="plus" :size="22" color="var(--color-text-hint)" />
          <span class="card-name card-name--hint">Новая тема</span>
        </button>
      </div>
    </div>

    <!-- Редактор темы -->
    <div v-if="editing" class="editor">
      <div class="editor-header">
        <span class="editor-title">{{ editing.id === 'new' ? 'Новая тема' : 'Редактирование' }}</span>
      </div>

      <div class="editor-row">
        <UiSelect
          :value="editing.basedOn"
          :options="presets.map(p => ({ value: p.value, label: p.label }))"
          label="На основе"
          @update:value="changeBase($event as TenantThemePreset)"
        />

        <UiInput
          v-model="editing.name"
          label="Название"
          placeholder="Моя тема"
          :clearable="false"
        />
      </div>

      <div class="field">
        <label class="label">Цвета</label>
        <div class="palette-grid">
          <div v-for="item in paletteItems" :key="item.key" class="palette-item">
            <input
              type="color"
              class="palette-input"
              :value="editing.palette[item.key]"
              @input="onPaletteColor(item.key, ($event.target as HTMLInputElement).value)"
            />
            <span class="palette-label">{{ item.label }}</span>
          </div>
        </div>
      </div>

      <div class="editor-footer">
        <UiButton v-if="editing.id !== 'new'" type="error" @click="confirmDelete(editing.id)">Удалить</UiButton>
        <span class="editor-footer-right">
          <UiButton @click="cancelEdit">Отмена</UiButton>
          <UiButton type="primary" @click="saveEdit">Сохранить тему</UiButton>
        </span>
      </div>
    </div>

    <div class="divider" />

    <div class="field">
      <UiSelect
        v-model:value="themeForm.fontFamily"
        :options="fontOptions"
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
import { computed, inject, onUnmounted, ref, watch } from 'vue'
import { UiSelect, UiInputNumber, UiRadioGroup, UiSegmentedControl, UiInput, UiButton, UiIcon, useMessage, UiSectionHeader } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import { themePresets, fontOptions } from '~/config/theme-presets'
import { isGoogleFontValue, fontFamilyCSS, googleFontUrl } from '~/config/google-fonts'
import { AppearanceFormKey } from '~/composables/data/useAppearanceForm'
import { getPresetPalette } from '@fastio/shared'
import type { TenantThemePreset, ThemePalette, CustomTheme } from '@fastio/shared'

const form = inject(AppearanceFormKey)!
const themeForm = form.themeForm
const presets = themePresets
const { warning } = useMessage()

// ─── font preview ─────────────────────────────────────────────────────────────

const loadedFonts = new Set<string>()
const loadedLinks: ReturnType<typeof document.createElement>[] = []

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

const loadGoogleFont = (value: string) => {
  if (!value || !isGoogleFontValue(value) || loadedFonts.has(value)) return
  loadedFonts.add(value)
  const link = document.createElement('link')

  link.rel = 'stylesheet'
  link.href = googleFontUrl(value)
  document.head.appendChild(link)
  loadedLinks.push(link)
}

onUnmounted(() => {
  loadedLinks.forEach((link) => link.remove())
})

watch(() => themeForm.fontFamily, loadGoogleFont, { immediate: true })
watch(() => themeForm.headingFontFamily, loadGoogleFont, { immediate: true })

// ─── editor state ────────────────────────────────────────────────────────────

type EditingState = {
  id: string | 'new'
  name: string
  basedOn: TenantThemePreset
  palette: ThemePalette
}

const editing = ref<EditingState | null>(null)
let paletteBeforeEdit: ThemePalette | null = null
let activeIdBeforeEdit: string | null = null

watch(() => editing.value?.palette, (palette) => {
  if (!palette) return
  themeForm.palette = { ...palette }
  themeForm.primaryColor = palette.primary
}, { deep: true })

const warnIfEditing = () => {
  if (!editing.value) return false
  warning('Сначала завершите редактирование кастомной темы')

  return true
}

const activatePreset = (name: TenantThemePreset) => {
  if (warnIfEditing()) return
  const palette = getPresetPalette(name)!

  themeForm.preset = name
  themeForm.palette = { ...palette }
  themeForm.primaryColor = palette.primary
  themeForm.activeCustomId = null
}

const openCreate = (basedOn: TenantThemePreset) => {
  if (warnIfEditing()) return
  paletteBeforeEdit = themeForm.palette ? { ...themeForm.palette } : null
  activeIdBeforeEdit = themeForm.activeCustomId
  const palette = getPresetPalette(basedOn)!

  editing.value = { id: 'new', name: '', basedOn, palette: { ...palette } }
}

const openEdit = (id: string) => {
  if (warnIfEditing()) return
  const ct = themeForm.customThemes.find((t) => t.id === id)

  if (!ct) return
  paletteBeforeEdit = themeForm.palette ? { ...themeForm.palette } : null
  activeIdBeforeEdit = themeForm.activeCustomId
  editing.value = { id, name: ct.name, basedOn: ct.basedOn, palette: { ...ct.palette } }
}

const cancelEdit = () => {
  if (paletteBeforeEdit) themeForm.palette = { ...paletteBeforeEdit }
  themeForm.activeCustomId = activeIdBeforeEdit
  editing.value = null
}

const saveEdit = () => {
  if (!editing.value) return
  const { id, name, basedOn, palette } = editing.value
  const finalName = name.trim() || `Тема ${themeForm.customThemes.length + 1}`

  if (id === 'new') {
    const newTheme: CustomTheme = {
      id: window.crypto.randomUUID(),
      name: finalName,
      basedOn,
      palette: { ...palette },
    }

    themeForm.customThemes.push(newTheme)
    activateTheme(newTheme.id)
  } else {
    const idx = themeForm.customThemes.findIndex((t) => t.id === id)

    if (idx !== -1) themeForm.customThemes[idx] = { id, name: finalName, basedOn, palette: { ...palette } }
    if (themeForm.activeCustomId === id) {
      themeForm.palette = { ...palette }
      themeForm.primaryColor = palette.primary
      themeForm.preset = basedOn
    }
  }
  editing.value = null
}

const activateTheme = (id: string) => {
  const ct = themeForm.customThemes.find((t) => t.id === id)

  if (!ct) return
  themeForm.activeCustomId = id
  themeForm.palette = { ...ct.palette }
  themeForm.preset = ct.basedOn
  themeForm.primaryColor = ct.palette.primary
}

const deleteTheme = (id: string) => {
  themeForm.customThemes = themeForm.customThemes.filter((t) => t.id !== id)
  if (themeForm.activeCustomId === id) {
    themeForm.activeCustomId = null
    const fallback = getPresetPalette(themeForm.preset) ?? getPresetPalette('fresh')!

    themeForm.palette = { ...fallback }
    themeForm.primaryColor = themeForm.palette.primary
  }
}

const { confirm } = useConfirm()

const confirmDelete = async (id: string) => {
  const ct = themeForm.customThemes.find((t) => t.id === id)
  const ok = await confirm({
    title: 'Удалить тему?',
    message: ct ? `Тема «${ct.name}» будет удалена без возможности восстановления.` : undefined,
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (ok) {
    deleteTheme(id)
    editing.value = null
  }
}

const changeBase = (basedOn: TenantThemePreset) => {
  if (!editing.value) return
  const palette = getPresetPalette(basedOn)

  if (palette) {
    editing.value.basedOn = basedOn
    editing.value.palette = { ...palette }
  }
}

const onPaletteColor = (key: keyof ThemePalette, value: string) => {
  if (!editing.value) return
  editing.value.palette[key] = value
}

// ─── options ─────────────────────────────────────────────────────────────────

const paletteItems: { key: keyof ThemePalette; label: string }[] = [
  { key: 'primary', label: 'Акцент' },
  { key: 'bg', label: 'Фон' },
  { key: 'surface', label: 'Поверхность' },
  { key: 'text', label: 'Текст' },
  { key: 'textSecondary', label: 'Текст 2' },
  { key: 'textMuted', label: 'Приглушённый' },
  { key: 'border', label: 'Граница' },
]

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

.group-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-hint);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.presets {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;

  @include mq-m {
    grid-template-columns: repeat(5, 1fr);
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

  &--custom {
    &.active {
      border-color: var(--p-primary);
      box-shadow: 0 0 0 1px var(--p-primary);

      .card-active-dot { opacity: 1; }
    }

    &.editing {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 1px var(--color-primary);
    }
  }

  &--new {
    border: 2px dashed var(--color-border);
    background: transparent;
    align-items: center;
    justify-content: center;
    min-height: 88px;
    gap: 4px;

    &:hover {
      border-color: var(--color-text-hint);
      box-shadow: none;
    }
  }
}

.card-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--p-text, var(--color-text));
  opacity: 0.65;
  text-align: center;
  line-height: 1.2;

  &--hint {
    color: var(--color-text-hint);
    opacity: 1;
    font-size: 11px;
  }
}

.card-active-dot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--p-primary);
  opacity: 0;
  transition: opacity 0.15s;
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

// ─── editor ───────────────────────────────────────────────────────────────────

.editor-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-card);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.editor-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
}

.palette-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 10px;
}

.palette-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.palette-input {
  width: 38px;
  height: 38px;
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

.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.editor-footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

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
