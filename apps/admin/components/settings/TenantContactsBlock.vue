<template>
  <UiCard size="large" class="block">
    <UiSectionHeader :title="title" />
    <UiText v-if="subtitle" size="tiny" class="subtitle">{{ subtitle }}</UiText>

    <UiForm class="form" @submit="handleSave">
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

      <div class="actions">
        <UiButton
          submit
          type="primary"
          :loading="saving"
          :disabled="!isDirty"
        >
          Сохранить
        </UiButton>
      </div>
    </UiForm>
  </UiCard>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { UiCard, UiForm, UiInput, UiButton, UiText, useMessage, UiSectionHeader } from '@fastio/ui'
import type { Tenant, WorkingHoursSchedule } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import WorkingHoursEditor from '~/components/settings/WorkingHoursEditor.vue'
import { useFormDirty } from '~/composables/ui/useFormDirty'
import { useUnsavedGuard } from '~/composables/ui/useUnsavedGuard'

const props = withDefaults(defineProps<{
  title?: string
  subtitle?: string
}>(), {
  title: 'Общие настройки',
  subtitle: '',
})

const tenantStore = useTenantStore()

const DEFAULT_SCHEDULE: WorkingHoursSchedule = { default: { open: '10:00', close: '22:00' }, days: {} }

const buildForm = (t: Tenant) => ({
  phone: t.contacts?.phone ?? '',
  workingHoursSchedule: t.workingHoursSchedule ?? DEFAULT_SCHEDULE,
})

const form = reactive(buildForm(tenantStore.tenant))
const { isDirty, reset } = useFormDirty(form)

watch(() => tenantStore.tenant, (t) => {
  Object.assign(form, buildForm(t))
  reset()
})

const saving = ref(false)
const { success } = useMessage()

useUnsavedGuard(isDirty)

const handleSave = async () => {
  saving.value = true
  try {
    await tenantStore.update({
      contacts: {
        ...tenantStore.tenant.contacts,
        phone: form.phone,
      },
      workingHoursSchedule: form.workingHoursSchedule,
    })
    reset()
    success('Сохранено')
  } finally {
    saving.value = false
  }
}
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

.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
