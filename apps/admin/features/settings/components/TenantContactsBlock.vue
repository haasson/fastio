<template>
  <UiCard size="large" class="block">
    <UiSectionHeader :title="title" />
    <UiText v-if="subtitle" size="tiny" class="subtitle">{{ subtitle }}</UiText>

    <UiForm class="form" @submit.prevent="page.submit">
      <UiInput
        v-model="form.phone"
        name="phone"
        label="Телефон"
        class="phone-input"
        placeholder="+7 (999) 000-00-00"
        :rules="[{ type: 'phone', message: 'Введите корректный телефон' }]"
      />

      <div class="hours-block">
        <UiText size="small" class="hours-label">Часы работы</UiText>
        <WorkingHoursEditor v-model="form.workingHoursSchedule" />
      </div>
    </UiForm>
  </UiCard>
</template>

<script setup lang="ts">
// Блок не self-contained: своих кнопок и unsaved-guard'а у него нет. Родитель должен
// забрать `handle` через template ref и зарегистрировать в pageForm — иначе save-bar
// не появится. Сейчас единственный потребитель — pages/branches.vue.
import { computed } from 'vue'
import { UiCard, UiForm, UiInput, UiText, UiSectionHeader } from '@fastio/ui'
import type { Tenant } from '@fastio/shared'
import { DEFAULT_WORKING_HOURS_SCHEDULE } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import WorkingHoursEditor from '~/components/settings/WorkingHoursEditor.vue'
import { useEditableForm } from '~/composables/ui/useEditableForm'

withDefaults(defineProps<{
  title?: string
  subtitle?: string
}>(), {
  title: 'Общие настройки',
  subtitle: '',
})

const tenantStore = useTenantStore()
const tenant = computed(() => tenantStore.tenant)

const page = useEditableForm({
  source: tenant,
  build: (t: Tenant) => ({
    phone: t.contacts?.phone ?? '',
    workingHoursSchedule: t.workingHoursSchedule ?? DEFAULT_WORKING_HOURS_SCHEDULE,
  }),
  save: (data) => tenantStore.update({
    contacts: {
      ...tenantStore.tenant.contacts,
      phone: data.phone,
    },
    workingHoursSchedule: data.workingHoursSchedule,
  }),
})

const { form } = page

defineExpose({ handle: page })
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.block {
  gap: var(--space-16);
}

.form {
  @include flex-col(var(--space-16));
}

.phone-input {
  max-width: 320px;
}

.hours-block {
  @include flex-col(var(--space-8));
}

.hours-label {
  font-weight: var(--font-weight-medium);
}

.subtitle {
  color: var(--color-text-hint);
  margin-top: calc(var(--space-8) * -1);
}
</style>
