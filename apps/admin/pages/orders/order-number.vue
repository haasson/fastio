<template>
  <UiForm class="form" @submit="handleSave">
    <UiSectionHeader title="Нумерация заказов" />

    <div data-tour="order-format">
      <UiRadioGroup
        v-model="form.format"
        label="Формат номера"
        :options="formatOptions"
        vertical
        :space="6"
      />
    </div>

    <div data-tour="order-scope">
      <UiRadioGroup
        v-model="form.scope"
        label="Нумерация"
        :options="scopeOptions"
        vertical
        :space="6"
      />

      <template v-if="showPrefix">
        <UiAlert v-if="form.scope === 'per_branch'" type="info">
          Префиксы задаются в настройках каждого филиала
        </UiAlert>
        <UiInput
          v-else
          v-model="form.prefix"
          label="Префикс"
          placeholder="ORD"
        />
      </template>
    </div>

    <div v-if="showDateFormat" data-tour="order-date-format">
      <UiRadioGroup
        v-model="form.dateFormat"
        label="Формат даты"
        :options="dateFormatOptions"
        :space="6"
      />
    </div>

    <div data-tour="order-reset">
      <UiRadioGroup
        v-model="form.resetPeriod"
        label="Сброс счётчика"
        :options="resetPeriodOptions"
        :space="6"
      />
    </div>

    <div data-tour="order-pad" class="row">
      <UiInputNumber
        v-model="form.padLength"
        label="Нули слева"
        :min="0"
        :max="6"
        :show-button="true"
        hint="0 — без нулей, 3 → «042»"
      />
      <UiInputNumber
        v-model="form.startFrom"
        label="Начать с"
        :min="1"
        :show-button="true"
        hint="Стартовое значение счётчика"
      />
    </div>

    <div class="preview">
      <span class="preview-label">Пример номера:</span>
      <span class="preview-value">{{ preview }}</span>
    </div>

    <div class="footer">
      <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
    </div>
  </UiForm>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiForm, UiInput, UiInputNumber, UiButton, UiRadioGroup, UiSectionHeader, UiAlert, useMessage } from '@fastio/ui'
import type { OrderNumberConfig } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'

const tenantStore = useTenantStore()
const { success } = useMessage()
const saving = ref(false)

const tenant = computed(() => tenantStore.tenant)

const formatOptions = [
  { value: 'counter', label: 'Только счётчик — 1042' },
  { value: 'prefix_counter', label: 'Префикс + счётчик — ORD-1042' },
  { value: 'date_counter', label: 'Дата + счётчик — 2303-042' },
  { value: 'prefix_date_counter', label: 'Префикс + дата + счётчик — ORD-2303-042' },
]

const scopeOptions = [
  { value: 'global', label: 'Сквозная — единый счётчик для всех филиалов' },
  { value: 'per_branch', label: 'По филиалам — у каждого свой счётчик и префикс' },
]

const dateFormatOptions = [
  { value: 'DDMM', label: '2303 (день + месяц)' },
  { value: 'DDMMYY', label: '230325 (день + месяц + год)' },
  { value: 'YYYYMMDD', label: '20250323 (полная дата)' },
]

const resetPeriodOptions = [
  { value: 'never', label: 'Никогда — постоянно растёт' },
  { value: 'daily', label: 'Ежедневно — с полуночи с нуля' },
]

const defaultConfig = (): OrderNumberConfig => ({
  format: 'counter',
  scope: 'global',
  prefix: '',
  dateFormat: 'DDMM',
  resetPeriod: 'never',
  padLength: 0,
  startFrom: 1,
})

const buildForm = (t: { orderNumberConfig?: OrderNumberConfig | null }): OrderNumberConfig => ({
  ...defaultConfig(),
  ...t.orderNumberConfig,
})

const form = reactive<OrderNumberConfig>(buildForm(tenant.value ?? {}))

watch(tenant, (t) => t && Object.assign(form, buildForm(t)))

const showPrefix = computed(() => form.format === 'prefix_counter' || form.format === 'prefix_date_counter',
)

const showDateFormat = computed(() => form.format === 'date_counter' || form.format === 'prefix_date_counter',
)

const preview = computed(() => {
  const pad = form.padLength
  const counter = form.startFrom ?? 1
  const counterStr = pad > 0 ? String(counter).padStart(pad, '0') : String(counter)

  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(2)
  const yyyy = String(now.getFullYear())

  let datePart = ''

  if (showDateFormat.value) {
    if (form.dateFormat === 'DDMM') datePart = dd + mm
    else if (form.dateFormat === 'DDMMYY') datePart = dd + mm + yy
    else datePart = yyyy + mm + dd
  }

  const prefix = form.scope === 'per_branch' ? '(префикс)' : form.prefix

  switch (form.format) {
    case 'counter': return counterStr
    case 'prefix_counter': return prefix ? `${prefix}-${counterStr}` : counterStr
    case 'date_counter': return `${datePart}-${counterStr}`
    case 'prefix_date_counter':
      return prefix ? `${prefix}-${datePart}-${counterStr}` : `${datePart}-${counterStr}`
    default: return counterStr
  }
})

const handleSave = async () => {
  saving.value = true
  try {
    await tenantStore.update({ orderNumberConfig: { ...form } })
    success('Сохранено')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/form' as *;
@use '@fastio/styles/mixins/layout' as *;

.form {
  @include flex-col(var(--space-20));
  max-width: 680px;
}

[data-tour="order-scope"] {
  @include flex-col(var(--space-12));
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12);
}

.preview {
  @include flex-row(var(--space-12));
  padding: var(--space-12) var(--space-16);
  background: var(--color-bg-soft);
  border-radius: var(--radius-8);
  border: 1px solid var(--color-border-light);
}

.preview-label {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.preview-value {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  font-family: monospace;
  color: var(--color-primary);
}

.footer {
  padding-top: var(--space-4);
}
</style>
