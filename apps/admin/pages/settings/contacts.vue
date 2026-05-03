<template>
  <UiForm class="form" @submit="handleSave">
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

    <div class="footer">
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
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiCard, UiForm, UiInput, UiButton, UiText, useMessage, UiSectionHeader, UiSelect } from '@fastio/ui'
import type { Tenant } from '@fastio/shared'
import { TIMEZONE_OPTIONS } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useGate } from '~/composables/plan/useGate'
import { isLockedBy } from '~/composables/plan/useGate.helpers'
import { useFormDirty } from '~/composables/ui/useFormDirty'
import { useUnsavedGuard } from '~/composables/ui/useUnsavedGuard'

const tenantStore = useTenantStore()
const gate = useGate()

const isVenueMode = isLockedBy(gate.branches, 'locked')
const branchesOptedOut = isLockedBy(gate.branches, 'opted-out')
const branchSectionLabel = computed(() => isVenueMode.value ? 'Заведение' : 'Филиалы')

const buildForm = (t: Tenant) => ({
  name: t.name ?? '',
  email: t.contacts?.email ?? '',
  instagram: t.contacts?.instagram ?? '',
  vk: t.contacts?.vk ?? '',
  telegram: t.contacts?.telegram ?? '',
  whatsapp: t.contacts?.whatsapp ?? '',
  max: t.contacts?.max ?? '',
  timezone: t.timezone,
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
      name: form.name,
      timezone: form.timezone,
      contacts: {
        ...tenantStore.tenant.contacts,
        email: form.email,
        instagram: form.instagram || null,
        vk: form.vk || null,
        telegram: form.telegram || null,
        whatsapp: form.whatsapp || null,
        max: form.max || null,
      },
    })
    reset()
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
  @include flex-col(var(--space-12));
  @include save-bar-offset;
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

.footer {
  @include fixed-save-bar;
}
</style>
