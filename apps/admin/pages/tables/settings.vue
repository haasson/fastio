<template>
  <div class="settings-root">
    <UiSkeleton v-if="ctx.loading || reservationLoading" :repeat="4" />

    <UiForm v-else class="form" @submit.prevent="page.submit">
      <!-- ── Заказ со стола (QR) ───────────────────────────── -->
      <UiFormSection
        title="Заказ со стола (QR)"
        help="Гость заказывает блюда прямо со страницы стола по QR. Выключено — меню только для просмотра."
        :columns="1"
      >
        <template #header-right>
          <UiSwitch v-model="form.dineInOrderingEnabled" />
        </template>
      </UiFormSection>

      <!-- ── Вызов официанта (тумблер в хедере, тело прячется при off) ── -->
      <UiFormSection
        title="Вызов официанта"
        help="Кнопка вызова официанта на странице стола по QR. Выключено — кнопка скрыта."
        :columns="1"
      >
        <template #header-right>
          <UiSwitch v-model="form.waiterCallEnabled" />
        </template>

        <template v-if="form.waiterCallEnabled">
          <!-- иконка + текст кнопки -->
          <div class="field">
            <span class="field-caption">Иконка и текст кнопки</span>
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
            <UiInput v-model="form.callButtonLabel" placeholder="Официант" />
          </div>

          <!-- превью: реальный хедер витрины в теме тенанта на мобильной ширине -->
          <div class="field">
            <span class="field-caption">Превью хедера витрины (мобильный)</span>
            <div class="header-preview" :style="headerVars">
              <span class="hp-name">{{ tenantName }}</span>
              <div class="hp-btn">
                <UiIcon :name="previewIcon" :size="16" />
                <span class="hp-btn-label">{{ form.callButtonLabel.trim() || 'Официант' }}</span>
              </div>
            </div>
          </div>

          <!-- кулдаун / эскалация -->
          <div class="row">
            <UiInputNumber
              v-model="form.callCooldownSeconds"
              label="Кулдаун (секунд)"
              :min="0"
              :max="600"
              :show-button="true"
              :clearable="false"
              help="Минимум между вызовами с одного стола; сервер отклонит частый повтор (кнопка не блокируется)."
            />
            <UiInputNumber
              v-model="form.callEscalationMinutes"
              label="Эскалация (минут)"
              :min="1"
              :max="120"
              :show-button="true"
              :clearable="false"
              help="Через сколько минут вызов станет красным (срочным)"
            />
          </div>

          <!-- типы вызовов (сохраняются сразу) -->
          <TableCallTypes
            :call-types="ctx.callTypes"
            @add-type="ctx.onCallTypeAdded"
            @remove-type="ctx.onCallTypeRemoved"
          />
        </template>
      </UiFormSection>

      <!-- ── Отображение столов ───────────────────────────── -->
      <UiFormSection title="Отображение столов" :columns="1">
        <div class="row">
          <UiSelect
            v-model:value="form.canvasTileSize"
            label="Размер карточек"
            :options="TILE_SIZE_OPTIONS"
            help="Ширина карточек столов в списке (вкладка «Столы»)"
          />
          <UiInputNumber
            v-model="form.listPreviewRows"
            label="Строк позиций на карточке"
            :min="1"
            :max="50"
            :show-button="true"
            :clearable="false"
            help="Сколько позиций показывать на карточке стола в списке, остальные — под «ещё»"
          />
        </div>
        <UiSettingRow
          label="Категория блюда на столах"
          help="Показывать категорию рядом с позицией (список и схема)"
        >
          <UiSwitch v-model="form.showDishCategory" />
        </UiSettingRow>
      </UiFormSection>

      <!-- ── Онлайн-бронирование (паттерн «Вызов официанта»: одна карточка, свитч в шапке) ── -->
      <UiFormSection
        title="Онлайн-бронирование"
        help="Гости бронируют столик с сайта-витрины. Лимит гостей в брони — по вместимости самого большого стола."
        :columns="1"
      >
        <template #header-right>
          <UiSwitch v-model="form.reservationEnabled" />
        </template>

        <template v-if="form.reservationEnabled">
          <AppStorefrontAlert feature-key="booking" />

          <UiAlert v-if="!hasSchedule" type="warning">
            Расписание работы не настроено — перейди в
            <a href="/branches">«Заведение»</a>
            и заполни часы работы по дням.
          </UiAlert>

          <div class="row-3">
            <UiSelect
              v-model:value="form.slotStep"
              label="Шаг слотов"
              :options="SLOT_STEP_OPTIONS"
            />
            <UiSelect
              v-model:value="form.closeBufferMinutes"
              label="Буфер до закрытия"
              :options="BUFFER_OPTIONS"
              help="Последняя бронь — за это время до закрытия"
            />
            <UiInputNumber
              v-model="form.maxAdvanceDays"
              label="Дней вперёд (макс.)"
              :min="1"
              :max="365"
              :show-button="true"
            />
          </div>

          <UiSettingRow
            label="Разрешить клиенту отменять бронь"
            help="Кнопка отмены в личном кабинете гостя на сайте"
          >
            <UiSwitch v-model="form.allowClientCancellation" />
          </UiSettingRow>
        </template>
      </UiFormSection>
    </UiForm>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { UiForm, UiFormSection, UiSettingRow, UiInput, UiInputNumber, UiSelect, UiSkeleton, UiSwitch, UiIcon, UiAlert } from '@fastio/ui'
import type { IconName } from '@fastio/icons'
import type { CanvasTileSize, ThemePalette, ReservationSettings } from '@fastio/shared'
import { DEFAULT_TABLE_SETTINGS, paletteToCssVars, getPresetPalette, THEME_PRESETS, TILE_SIZE_OPTIONS } from '@fastio/shared'
import { useTablesContext } from '~/features/tables'
import TableCallTypes from '~/features/tables/components/TableCallTypes.vue'
import AppStorefrontAlert from '~/shared/ui/components/AppStorefrontAlert.vue'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/shared/data/useDatabase'
import { useEditableForm } from '~/shared/ui/composables/useEditableForm'
import { useRegisterPageForm } from '~/shared/ui/composables/usePageForm'
import { useUnsavedGuard } from '~/shared/ui/composables/useUnsavedGuard'

const ctx = useTablesContext()
const tenantStore = useTenantStore()
const api = useDatabase()

// ── Бронирование (часть модуля «Столы») ───────────────────
const SLOT_STEP_OPTIONS = [
  { label: '15 мин', value: 15 },
  { label: '30 мин', value: 30 },
  { label: '60 мин', value: 60 },
]

const BUFFER_OPTIONS = [
  { label: '30 минут', value: 30 },
  { label: '1 час', value: 60 },
  { label: '1.5 часа', value: 90 },
  { label: '2 часа', value: 120 },
  { label: '3 часа', value: 180 },
]

// Расписание нужно для генерации слотов брони на витрине.
const hasSchedule = computed(() => !!tenantStore.tenant.workingHoursSchedule)

const reservationSource = ref<ReservationSettings | null>(null)
const reservationLoading = ref(true)

onMounted(async () => {
  const id = tenantStore.currentTenantId

  if (!id) {
    reservationLoading.value = false

    return
  }
  reservationSource.value = await api.reservationSettings.get(id)
  reservationLoading.value = false
})

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

type Form = {
  callButtonLabel: string
  callButtonIcon: string | null
  callCooldownSeconds: number
  callEscalationMinutes: number
  canvasTileSize: CanvasTileSize
  showDishCategory: boolean
  listPreviewRows: number
  dineInOrderingEnabled: boolean
  waiterCallEnabled: boolean
  // ── Бронирование ──
  reservationEnabled: boolean
  slotStep: number
  maxAdvanceDays: number
  closeBufferMinutes: number
  allowClientCancellation: boolean
}

type Source = {
  table: typeof ctx.tableSettings
  reservation: ReservationSettings | null
  bookingEnabled: boolean
}

// Свич приёма онлайн-броней — table_settings.booking_enabled (как «заказ со стола»
// и «вызов официанта»); его читает витрина (гейт = dineIn AND booking_enabled).
// Поля слотов/гостей — reservation_settings. Все наборы + настройки столов живут
// в одной форме и сохраняются одной кнопкой.
const settingsSource = computed<Source>(() => ({
  table: ctx.tableSettings,
  reservation: reservationSource.value,
  bookingEnabled: ctx.tableSettings?.bookingEnabled ?? DEFAULT_TABLE_SETTINGS.bookingEnabled,
}))

const page = useEditableForm({
  source: settingsSource,
  build: (s): Form => {
    const t = s.table
    const r = s.reservation

    return {
      callButtonLabel: t?.callButtonLabel ?? DEFAULT_TABLE_SETTINGS.callButtonLabel,
      callButtonIcon: t?.callButtonIcon ?? DEFAULT_TABLE_SETTINGS.callButtonIcon,
      callCooldownSeconds: t?.callCooldownSeconds ?? DEFAULT_TABLE_SETTINGS.callCooldownSeconds,
      callEscalationMinutes: t?.callEscalationMinutes ?? DEFAULT_TABLE_SETTINGS.callEscalationMinutes,
      canvasTileSize: t?.canvasTileSize ?? DEFAULT_TABLE_SETTINGS.canvasTileSize,
      showDishCategory: t?.showDishCategory ?? DEFAULT_TABLE_SETTINGS.showDishCategory,
      listPreviewRows: t?.listPreviewRows ?? DEFAULT_TABLE_SETTINGS.listPreviewRows,
      dineInOrderingEnabled: t?.dineInOrderingEnabled ?? DEFAULT_TABLE_SETTINGS.dineInOrderingEnabled,
      waiterCallEnabled: t?.waiterCallEnabled ?? DEFAULT_TABLE_SETTINGS.waiterCallEnabled,
      reservationEnabled: s.bookingEnabled,
      slotStep: r?.slotStep ?? 30,
      maxAdvanceDays: r?.maxAdvanceDays ?? 30,
      closeBufferMinutes: r?.closeBufferMinutes ?? 60,
      allowClientCancellation: r?.allowClientCancellation ?? true,
    }
  },
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
      listPreviewRows: data.listPreviewRows,
      dineInOrderingEnabled: data.dineInOrderingEnabled,
      waiterCallEnabled: data.waiterCallEnabled,
      // Приём онлайн-броней — под-флаг модуля «Столы», хранится в table_settings.
      bookingEnabled: data.reservationEnabled,
    })

    ctx.onSettingsSaved(saved)

    // maxGuests/maxGuestsAuto не редактируются: лимит брони всегда по самому
    // большому столу (max_guests_auto = true по умолчанию, см. миграцию 315).
    reservationSource.value = await api.reservationSettings.upsert(tid, {
      slotStep: data.slotStep,
      maxAdvanceDays: data.maxAdvanceDays,
      closeBufferMinutes: data.closeBufferMinutes,
      allowClientCancellation: data.allowClientCancellation,
    })
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

const tenantName = computed(() => tenantStore.maybeTenant?.name ?? 'Заведение')

// Активная палитра витрины: кастомная тема → своя палитра тенанта → пресет.
const effectivePalette = computed<ThemePalette>(() => {
  const t = tenantStore.maybeTenant?.theme
  const custom = t?.activeCustomId ? t.customThemes?.find((c) => c.id === t.activeCustomId)?.palette : null

  return custom ?? t?.palette ?? (t ? getPresetPalette(t.preset) : null) ?? THEME_PRESETS[0].palette
})

// CSS-vars темы витрины для превью-хедера (+ on-primary как на витрине).
const headerVars = computed(() => {
  const vars = paletteToCssVars(effectivePalette.value)

  vars['--on-primary'] = hexToOnColor(effectivePalette.value.primary)

  return vars
})

useRegisterPageForm(page)
useUnsavedGuard(page.isDirty)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;
@use '@fastio/styles/mixins/media-queries' as mq;

.settings-root {
  max-width: 720px;
}

.form {
  @include flex-col(var(--space-12));
}

.field {
  @include flex-col(var(--space-8));
}

// Лейбл поля-группы — как у обычных полей формы (12px), а не подзаголовок.
.field-caption {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

// Пара контролов в ряд; ширину самого контрола внутри ячейки капит проп width.
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12);
  align-items: start;
}

// Тройка контролов: на мобиле в столбик, с планшета — три в ряд.
.row-3 {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-12);
  align-items: start;

  @include mq.mq-m {
    grid-template-columns: repeat(3, 1fr);
  }
}

// Мок мобильного хедера витрины — цвета из темы тенанта (headerVars inline).
.header-preview {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  width: 100%;
  max-width: 390px;
  padding: 0 var(--space-16);
  height: 56px;
  box-sizing: border-box;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
}

.hp-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.hp-btn {
  margin-left: auto;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-12);
  border-radius: var(--radius-pill);
  background: var(--primary);
  color: var(--on-primary);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.hp-btn-label {
  font-size: var(--font-size-sm);
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
