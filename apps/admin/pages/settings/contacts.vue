<template>
  <UiForm class="form" @submit.prevent="page.submit">
    <UiCard size="large" class="section">
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

      <UiSelect
        v-model:value="form.timezone"
        label="Часовой пояс"
        :options="TIMEZONE_OPTIONS"
        filterable
        class="timezone-select"
      />

      <UiText v-if="!branchesOptedOut" size="tiny" class="hint">
        Телефон и часы работы заведения настраиваются в разделе
        <NuxtLink to="/branches" class="hint-link">«{{ branchSectionLabel }}»</NuxtLink>.
      </UiText>
    </UiCard>

    <UiCard size="large" class="section">
      <UiSectionHeader title="Соцсети и мессенджеры" />

      <div class="grid">
        <UiInput v-model="form.instagram" label="Instagram" placeholder="@vasya_pizza" />
        <UiInput v-model="form.vk" label="ВКонтакте" placeholder="vk.com/vasya_pizza" />
        <UiInput v-model="form.telegram" label="Telegram" placeholder="@vasya_pizza" />
        <UiInput v-model="form.whatsapp" label="WhatsApp" placeholder="+7 (999) 000-00-00" />
        <UiInput v-model="form.max" label="MAX" placeholder="@vasya_pizza" />
      </div>
    </UiCard>
  </UiForm>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiCard, UiForm, UiInput, UiText, UiSectionHeader, UiSelect } from '@fastio/ui'
import type { Tenant } from '@fastio/shared'
import { TIMEZONE_OPTIONS } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useGate } from '~/shared/plan/useGate'
import { isLockedBy } from '~/shared/plan/useGate.helpers'
import { useEditableForm } from '~/shared/ui/composables/useEditableForm'
import { useRegisterPageForm } from '~/shared/ui/composables/usePageForm'
import { useUnsavedGuard } from '~/shared/ui/composables/useUnsavedGuard'

const tenantStore = useTenantStore()
const gate = useGate()

const isVenueMode = isLockedBy(gate.branches, 'locked')
const branchesOptedOut = isLockedBy(gate.branches, 'opted-out')
const branchSectionLabel = computed(() => isVenueMode.value ? 'Заведение' : 'Филиалы')

const tenant = computed(() => tenantStore.tenant)

const page = useEditableForm({
  source: tenant,
  build: (t: Tenant) => ({
    name: t.name ?? '',
    email: t.contacts?.email ?? '',
    instagram: t.contacts?.instagram ?? '',
    vk: t.contacts?.vk ?? '',
    telegram: t.contacts?.telegram ?? '',
    whatsapp: t.contacts?.whatsapp ?? '',
    max: t.contacts?.max ?? '',
    timezone: t.timezone,
  }),
  save: (data) => tenantStore.update({
    name: data.name,
    timezone: data.timezone,
    contacts: {
      ...tenantStore.tenant.contacts,
      email: data.email,
      instagram: data.instagram || null,
      vk: data.vk || null,
      telegram: data.telegram || null,
      whatsapp: data.whatsapp || null,
      max: data.max || null,
    },
  }),
})

const { form } = page

useRegisterPageForm(page)
useUnsavedGuard(page.isDirty)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;
@use '@fastio/styles/mixins/media-queries' as *;

.form {
  @include flex-col(var(--space-12));
  max-width: 680px;
}

.section {
  gap: var(--space-16);
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-12);

  @include mq-m {
    grid-template-columns: 1fr 1fr;
  }
}

.timezone-select {
  max-width: 320px;
}

.hint {
  color: var(--color-text-hint);
}

.hint-link {
  color: var(--color-primary);
  text-decoration: none;

  &:hover { text-decoration: underline; }
}
</style>
