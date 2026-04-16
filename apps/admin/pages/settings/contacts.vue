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

    <UiInput
      v-model="form.phone"
      name="phone"
      label="Телефон"
      class="phone-input"
      placeholder="+7 (999) 000-00-00"
      :rules="[{ type: 'phone', message: 'Введите корректный телефон' }]"
    />

    <UiSelect
      v-model:value="form.timezone"
      label="Часовой пояс"
      :options="TIMEZONE_OPTIONS"
      filterable
      class="timezone-select"
    />

    <UiSectionHeader title="Часы работы" />

    <WorkingHoursEditor v-model="form.workingHoursSchedule" />

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
import { UiForm, UiInput, UiButton, useMessage, UiSectionHeader, UiSelect } from '@fastio/ui'
import type { Tenant, WorkingHoursSchedule } from '@fastio/shared'
import { TIMEZONE_OPTIONS } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import WorkingHoursEditor from '~/components/settings/WorkingHoursEditor.vue'

const tenantStore = useTenantStore()

const DEFAULT_SCHEDULE: WorkingHoursSchedule = { default: { open: '10:00', close: '22:00' }, days: {} }

const buildForm = (t: Tenant) => ({
  name: t.name ?? '',
  phone: t.contacts?.phone ?? '',
  email: t.contacts?.email ?? '',
  instagram: t.contacts?.instagram ?? '',
  vk: t.contacts?.vk ?? '',
  telegram: t.contacts?.telegram ?? '',
  whatsapp: t.contacts?.whatsapp ?? '',
  max: t.contacts?.max ?? '',
  timezone: t.timezone ?? 'Europe/Moscow',
  workingHoursSchedule: t.workingHoursSchedule ?? DEFAULT_SCHEDULE,
})

const form = reactive(buildForm(tenantStore.tenant!))

watch(() => tenantStore.tenant, (t) => {
  if (t) Object.assign(form, buildForm(t))
})

const saving = ref(false)
const { success } = useMessage()

const handleSave = async () => {
  saving.value = true
  try {
    await tenantStore.update({
      name: form.name,
      timezone: form.timezone,
      contacts: {
        ...tenantStore.tenant!.contacts,
        phone: form.phone,
        email: form.email,
        instagram: form.instagram || null,
        vk: form.vk || null,
        telegram: form.telegram || null,
        whatsapp: form.whatsapp || null,
        max: form.max || null,
      },
      workingHoursSchedule: form.workingHoursSchedule,
    })
    success('Сохранено')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/form' as *;
@use '@fastio/styles/mixins/layout' as *;
@use '@fastio/styles/mixins/media-queries' as *;

.form {
  @include flex-col(var(--space-20));
  max-width: 680px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-12);

  @include mq-m {
    grid-template-columns: 1fr 1fr;
  }
}

.phone-input {
  max-width: 320px;
}

.timezone-select {
  max-width: 320px;
}

.footer {
  @include settings-footer;
}
</style>
