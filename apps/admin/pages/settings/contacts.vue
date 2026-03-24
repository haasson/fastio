<template>
  <UiForm class="form" @submit="handleSave">
    <UiSectionHeader title="Основное" />

    <div class="grid">
      <UiInput
        v-model="form.name"
        name="name"
        label="Название заведения *"
        placeholder="Пицца Васи"
        :rules="[{ type: 'required', message: 'Введите название' }]"
      />
      <UiInput v-model="form.email" label="Email" placeholder="info@vasya-pizza.ru" />
    </div>

    <div class="phone-block">
      <UiRadioGroup
        v-model="form.phoneMode"
        label="Телефон"
        :options="phoneModeOptions"
        vertical
        :space="6"
      />
      <UiInput
        v-if="form.phoneMode === 'shared'"
        v-model="form.phone"
        name="phone"
        class="phone-input"
        placeholder="+7 (999) 000-00-00"
        :rules="[{ type: 'required', message: 'Введите телефон' }, { type: 'phone', message: 'Введите корректный телефон' }]"
      />
    </div>

    <UiSelect
      v-model="form.timezone"
      label="Часовой пояс"
      :options="TIMEZONE_OPTIONS"
      filterable
      class="timezone-select"
    />

    <UiSectionHeader title="Часы работы" />

    <div class="hours-default">
      <UiTimepicker v-model="form.scheduleOpen" label="Открытие" />
      <UiTimepicker v-model="form.scheduleClose" label="Закрытие" />
    </div>

    <UiCheckbox v-model="form.useCustomDays">Разное время по дням</UiCheckbox>

    <div v-if="form.useCustomDays" class="days-grid">
      <div v-for="day in DAYS" :key="day.key" class="day-row">
        <span class="day-name">{{ day.label }}</span>
        <UiTimepicker v-model="form.days[day.key].open" />
        <UiTimepicker v-model="form.days[day.key].close" />
      </div>
    </div>

    <UiSectionHeader title="Соцсети и мессенджеры" />

    <div class="grid">
      <UiInput v-model="form.instagram" label="Instagram" placeholder="@vasya_pizza" />
      <UiInput v-model="form.vk" label="ВКонтакте" placeholder="vk.com/vasya_pizza" />
      <UiInput v-model="form.telegram" label="Telegram" placeholder="@vasya_pizza" />
      <UiInput v-model="form.whatsapp" label="WhatsApp" placeholder="+7 (999) 000-00-00" />
      <UiInput v-model="form.max" label="MAX" placeholder="@vasya_pizza" />
    </div>

    <div class="footer">
      <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
    </div>
  </UiForm>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { UiForm, UiInput, UiButton, UiRadioGroup, useMessage, UiSectionHeader, UiCheckbox, UiTimepicker, UiSelect } from '@fastio/ui'
import type { Tenant, WorkingHoursSchedule } from '@fastio/shared'
import { TIMEZONE_OPTIONS } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'

const DAYS = [
  { key: '1', label: 'Пн' },
  { key: '2', label: 'Вт' },
  { key: '3', label: 'Ср' },
  { key: '4', label: 'Чт' },
  { key: '5', label: 'Пт' },
  { key: '6', label: 'Сб' },
  { key: '7', label: 'Вс' },
]

const props = defineProps<{ tenant: Tenant }>()
const tenantStore = useTenantStore()

const phoneModeOptions = [
  { value: 'shared', label: 'Один номер для всех филиалов' },
  { value: 'per_branch', label: 'Разные номера — указываются в каждом филиале' },
]

const buildDays = (schedule: WorkingHoursSchedule | null) => Object.fromEntries(DAYS.map((d) => {
  const override = schedule?.days[d.key]

  return [d.key, {
    open: (override?.open ?? schedule?.default.open ?? '10:00') as string | null,
    close: (override?.close ?? schedule?.default.close ?? '22:00') as string | null,
  }]
}))

const buildForm = (t: Tenant) => ({
  name: t.name ?? '',
  phoneMode: t.contacts?.phoneMode ?? 'shared',
  phone: t.contacts?.phone ?? '',
  email: t.contacts?.email ?? '',
  instagram: t.contacts?.instagram ?? '',
  vk: t.contacts?.vk ?? '',
  telegram: t.contacts?.telegram ?? '',
  whatsapp: t.contacts?.whatsapp ?? '',
  max: t.contacts?.max ?? '',
  timezone: t.timezone ?? 'Europe/Moscow',
  scheduleOpen: (t.workingHoursSchedule?.default.open ?? '10:00') as string | null,
  scheduleClose: (t.workingHoursSchedule?.default.close ?? '22:00') as string | null,
  useCustomDays: t.workingHoursSchedule ? Object.keys(t.workingHoursSchedule.days).length > 0 : false,
  days: buildDays(t.workingHoursSchedule ?? null),
})

const form = reactive(buildForm(props.tenant))

watch(() => props.tenant, (t) => Object.assign(form, buildForm(t)))

const saving = ref(false)
const { success } = useMessage()

const handleSave = async () => {
  saving.value = true
  try {
    const days: WorkingHoursSchedule['days'] = {}

    if (form.useCustomDays) {
      for (const day of DAYS) {
        days[day.key] = {
          open: form.days[day.key].open ?? '10:00',
          close: form.days[day.key].close ?? '22:00',
        }
      }
    }

    await tenantStore.update({
      name: form.name,
      timezone: form.timezone,
      contacts: {
        phoneMode: form.phoneMode as 'shared' | 'per_branch',
        phone: form.phoneMode === 'shared' ? form.phone : '',
        email: form.email,
        address: '',
        instagram: form.instagram || null,
        vk: form.vk || null,
        telegram: form.telegram || null,
        whatsapp: form.whatsapp || null,
        max: form.max || null,
      },
      workingHoursSchedule: {
        default: {
          open: form.scheduleOpen ?? '10:00',
          close: form.scheduleClose ?? '22:00',
          closeNextDay: form.scheduleCloseNextDay || undefined,
        },
        days,
      },
    })
    success('Сохранено')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/form' as *;
@use '@fastio/styles/mixins/media-queries' as *;

.form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 680px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;

  @include mq-m {
    grid-template-columns: 1fr 1fr;
  }
}

.phone-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.phone-input {
  max-width: 320px;
}

.hours-default {
  display: flex;
  align-items: flex-end;
  gap: 14px;
}

.days-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.day-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.day-name {
  width: 24px;
  font-size: 13px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.timezone-select {
  max-width: 320px;
}

.footer {
  @include settings-footer;
}
</style>
