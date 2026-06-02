<template>
  <div class="settings-root">
    <UiSkeleton v-if="ctx.loading" :repeat="4" />

    <template v-else>
      <UiForm class="form" @submit.prevent="page.submit">
        <!-- ── Вызов официанта ──────────────────────────────── -->
        <UiSectionHeader title="Вызов официанта" />

        <div class="icon-picker">
          <div class="picker-head">
            <UiText size="small" class="picker-label">Иконка и текст кнопки</UiText>
            <div class="preview-btn" :style="previewBtnStyle">
              <UiIcon :name="previewIcon" :size="16" />
              <span class="preview-btn-label">{{ form.callButtonLabel.trim() || 'Официант' }}</span>
            </div>
          </div>
          <div class="picker-body">
            <div class="icon-grid">
              <button
                v-for="icon in CALL_ICONS"
                :key="icon.name"
                type="button"
                class="icon-cell"
                :class="{ active: form.callButtonIcon === icon.name }"
                :title="icon.label"
                :aria-label="icon.label"
                @click="selectIcon(icon.name)"
              >
                <UiIcon :name="icon.name" :size="20" />
              </button>
            </div>
            <UiInput
              v-model="form.callButtonLabel"
              placeholder="Официант"
              class="label-input"
            />
          </div>
        </div>

        <div class="row">
          <UiInputNumber
            v-model="form.callCooldownSeconds"
            label="Кулдаун (секунд)"
            :min="0"
            :max="600"
            :show-button="true"
            message="Минимум между вызовами с одного стола; сервер отклонит частый повтор (кнопка не блокируется)."
          />
          <UiInputNumber
            v-model="form.callEscalationMinutes"
            label="Эскалация (минут)"
            :min="1"
            :max="120"
            :show-button="true"
            message="Через сколько минут вызов станет красным (срочным)"
          />
        </div>

        <!-- ── Отображение зала ─────────────────────────────── -->
        <UiSectionHeader title="Отображение зала" />

        <div class="row">
          <UiSelect
            v-model:value="form.canvasTileSize"
            label="Размер плитки стола"
            :options="TILE_SIZE_OPTIONS"
            message="Размер столов на схеме зала"
          />
          <UiSwitch
            v-model="form.showDishCategory"
            label="Категория блюда на столах"
            message="Показывать категорию рядом с позицией (список и схема)"
          />
        </div>
      </UiForm>

      <!-- ── Типы вызовов (сохраняются сразу) ───────────────── -->
      <TableCallTypes
        :call-types="ctx.callTypes"
        @add-type="ctx.onCallTypeAdded"
        @remove-type="ctx.onCallTypeRemoved"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiForm, UiInput, UiInputNumber, UiSelect, UiSectionHeader, UiSkeleton, UiSwitch, UiText, UiIcon } from '@fastio/ui'
import type { IconName } from '@fastio/icons'
import type { CanvasTileSize } from '@fastio/shared'
import { DEFAULT_TABLE_SETTINGS } from '@fastio/shared'
import { useTablesContext } from '~/features/tables'
import TableCallTypes from '~/features/tables/components/TableCallTypes.vue'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/shared/data/useDatabase'
import { useEditableForm } from '~/shared/ui/composables/useEditableForm'
import { useRegisterPageForm } from '~/shared/ui/composables/usePageForm'
import { useUnsavedGuard } from '~/shared/ui/composables/useUnsavedGuard'

const ctx = useTablesContext()
const tenantStore = useTenantStore()
const api = useDatabase()

// callButtonIcon = null → дефолт «колокольчик» (bellRing) и в превью, и на витрине.
const DEFAULT_CALL_ICON: IconName = 'bellRing'

const CALL_ICONS: { name: IconName; label: string }[] = [
  { name: 'bellRing', label: 'Колокольчик' },
  { name: 'messageCircle', label: 'Сообщение' },
  { name: 'chefHat', label: 'Повар' },
  { name: 'dishes', label: 'Блюда' },
  { name: 'creditCard', label: 'Счёт' },
  { name: 'users', label: 'Гости' },
  { name: 'help', label: 'Помощь' },
  { name: 'clock', label: 'Время' },
]

const TILE_SIZE_OPTIONS: { label: string; value: CanvasTileSize }[] = [
  { label: 'Компактные', value: 's' },
  { label: 'Средние', value: 'm' },
  { label: 'Крупные', value: 'l' },
]

type Form = {
  callButtonLabel: string
  callButtonIcon: string | null
  callCooldownSeconds: number
  callEscalationMinutes: number
  canvasTileSize: CanvasTileSize
  showDishCategory: boolean
}

const settingsSource = computed(() => ctx.tableSettings)

const page = useEditableForm({
  source: settingsSource,
  build: (s): Form => ({
    callButtonLabel: s?.callButtonLabel ?? DEFAULT_TABLE_SETTINGS.callButtonLabel,
    callButtonIcon: s?.callButtonIcon ?? DEFAULT_TABLE_SETTINGS.callButtonIcon,
    callCooldownSeconds: s?.callCooldownSeconds ?? DEFAULT_TABLE_SETTINGS.callCooldownSeconds,
    callEscalationMinutes: s?.callEscalationMinutes ?? DEFAULT_TABLE_SETTINGS.callEscalationMinutes,
    canvasTileSize: s?.canvasTileSize ?? DEFAULT_TABLE_SETTINGS.canvasTileSize,
    showDishCategory: s?.showDishCategory ?? DEFAULT_TABLE_SETTINGS.showDishCategory,
  }),
  errorMessage: 'Не удалось сохранить настройки',
  save: async (data) => {
    const tid = tenantStore.currentTenantId

    if (!tid) return

    const saved = await api.tableSettings.upsert(tid, {
      callButtonLabel: data.callButtonLabel.trim() || DEFAULT_TABLE_SETTINGS.callButtonLabel,
      callButtonIcon: data.callButtonIcon,
      callCooldownSeconds: data.callCooldownSeconds,
      callEscalationMinutes: data.callEscalationMinutes,
      canvasTileSize: data.canvasTileSize,
      showDishCategory: data.showDishCategory,
    })

    ctx.onSettingsSaved(saved)
  },
  successMessage: 'Настройки сохранены',
})

const { form } = page

// Превью отражает только иконки из набора; «левое» значение из БД → дефолт.
const previewIcon = computed<IconName>(() => CALL_ICONS.find((i) => i.name === form.callButtonIcon)?.name ?? DEFAULT_CALL_ICON)

const selectIcon = (name: IconName) => {
  // Повторный клик по выбранной иконке сбрасывает на дефолт (колокольчик/bellRing на витрине).
  form.callButtonIcon = form.callButtonIcon === name ? null : name
}

// Контрастный текст на бренд-цвете (WCAG luminance) — как на витрине (useTheme).
const hexToOnColor = (hex: string): string => {
  const n = parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255

    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? '#000000' : '#ffffff'
}

// Превью в реальных цветах темы витрины (бренд-primary тенанта + контрастный текст).
const previewBtnStyle = computed(() => {
  const primary = tenantStore.maybeTenant?.theme?.primaryColor

  if (!primary) return undefined

  return { background: primary, color: hexToOnColor(primary) }
})

useRegisterPageForm(page)
useUnsavedGuard(page.isDirty)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/form' as *;
@use '@fastio/styles/mixins/layout' as *;

.settings-root {
  @include flex-col(var(--space-24));
  max-width: 680px;
}

.form {
  @include modal-form;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12);
  align-items: start;
}

.preview-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-8);
  padding: var(--space-8) var(--space-16);
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-white);
  width: fit-content;
  font-weight: var(--font-weight-semibold);
}

.preview-btn-label {
  font-size: var(--font-size-sm);
}

.icon-picker {
  @include flex-col(var(--space-8));
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
  flex-wrap: wrap;
}

.picker-body {
  @include flex-col(var(--space-8));
}

.label-input {
  max-width: 320px;
}

.picker-label {
  color: var(--color-text-secondary);
}

.icon-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}

.icon-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &.active {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-white);
  }
}
</style>
