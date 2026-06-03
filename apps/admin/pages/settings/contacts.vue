<template>
  <UiForm class="form" @submit.prevent="page.submit">
    <UiFormSection title="Основное">
      <UiInput
        v-model="form.name"
        name="name"
        label="Название заведения *"
        placeholder="Пицца Васи"
        :rules="[{ type: 'required', message: 'Введите название' }]"
      />
      <UiInput
        v-model="form.phone"
        label="Телефон"
        placeholder="+7 (900) 000-00-00"
      />
      <UiInput v-model="form.email" label="Email" placeholder="info@vasya-pizza.ru" />
      <UiSelect
        v-model:value="form.timezone"
        label="Часовой пояс"
        :options="TIMEZONE_OPTIONS"
        filterable
      />
    </UiFormSection>

    <UiFormSection title="Часы работы" :columns="1">
      <UiAlert
        v-if="branchesEnabled"
        size="small"
        type="info"
      >
        Это глобальное расписание. Филиал может перекрыть его своим — настрой в
        <NuxtLink to="/branches" class="alert-link">разделе Филиалы</NuxtLink>.
      </UiAlert>
      <WorkingHoursEditor v-model="form.workingHoursSchedule" />
    </UiFormSection>

    <UiFormSection title="Соцсети и мессенджеры">
      <UiInput v-model="form.instagram" label="Instagram" placeholder="@vasya_pizza" />
      <UiInput v-model="form.vk" label="ВКонтакте" placeholder="vk.com/vasya_pizza" />
      <UiInput v-model="form.telegram" label="Telegram" placeholder="@vasya_pizza" />
      <UiInput v-model="form.whatsapp" label="WhatsApp" placeholder="+7 (999) 000-00-00" />
      <UiInput v-model="form.max" label="MAX" placeholder="@vasya_pizza" />
    </UiFormSection>
  </UiForm>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiForm, UiFormSection, UiInput, UiSelect, UiAlert } from '@fastio/ui'
import type { Tenant } from '@fastio/shared'
import { TIMEZONE_OPTIONS, DEFAULT_WORKING_HOURS_SCHEDULE } from '@fastio/shared'
import type { WorkingHoursSchedule } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useGate } from '~/shared/plan/useGate'
import { useEditableForm } from '~/shared/ui/composables/useEditableForm'
import { useRegisterPageForm } from '~/shared/ui/composables/usePageForm'
import { useUnsavedGuard } from '~/shared/ui/composables/useUnsavedGuard'
import WorkingHoursEditor from '~/features/settings/components/WorkingHoursEditor.vue'

const tenantStore = useTenantStore()
const gate = useGate()

const branchesEnabled = computed(() => gate.branches.value.enabled)

const tenant = computed(() => tenantStore.tenant)

const page = useEditableForm({
  source: tenant,
  build: (t: Tenant) => ({
    name: t.name ?? '',
    phone: t.contacts?.phone ?? '',
    email: t.contacts?.email ?? '',
    instagram: t.contacts?.instagram ?? '',
    vk: t.contacts?.vk ?? '',
    telegram: t.contacts?.telegram ?? '',
    whatsapp: t.contacts?.whatsapp ?? '',
    max: t.contacts?.max ?? '',
    timezone: t.timezone,
    workingHoursSchedule: (t.workingHoursSchedule ?? { ...DEFAULT_WORKING_HOURS_SCHEDULE }) as WorkingHoursSchedule,
  }),
  save: (data) => tenantStore.update({
    name: data.name,
    timezone: data.timezone,
    workingHoursSchedule: data.workingHoursSchedule,
    contacts: {
      ...tenantStore.tenant.contacts,
      phone: data.phone,
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

.form {
  @include flex-col(var(--space-12));
  max-width: 720px;
}

.alert-link {
  color: inherit;
  font-weight: var(--font-weight-semibold);

  &:hover { text-decoration: underline; }
}
</style>
