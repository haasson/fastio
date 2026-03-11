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

    <UiInput
      v-model="form.workingHours"
      label="Часы работы"
      type="textarea"
      :rows="2"
      placeholder="Пн–Пт 10:00–22:00, Сб–Вс 11:00–21:00"
    />

    <UiSectionHeader title="Соцсети и мессенджеры" />

    <div class="grid">
      <UiInput v-model="form.instagram" label="Instagram" placeholder="@vasya_pizza" />
      <UiInput v-model="form.vk" label="ВКонтакте" placeholder="vk.com/vasya_pizza" />
      <UiInput v-model="form.telegram" label="Telegram" placeholder="@vasya_pizza" />
      <UiInput v-model="form.whatsapp" label="WhatsApp" placeholder="+7 (999) 000-00-00" />
    </div>

    <div class="footer">
      <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
    </div>
  </UiForm>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { UiForm, UiInput, UiButton, UiText, UiRadioGroup, useMessage } from '@fastio/ui'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import type { Tenant } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'

const props = defineProps<{ tenant: Tenant }>()

const tenantStore = useTenantStore()

const phoneModeOptions = [
  { value: 'shared', label: 'Один номер для всех филиалов' },
  { value: 'per_branch', label: 'Разные номера — указываются в каждом филиале' },
]

const buildForm = (t: Tenant) => ({
  name: t.name ?? '',
  phoneMode: t.contacts?.phoneMode ?? 'shared',
  phone: t.contacts?.phone ?? '',
  email: t.contacts?.email ?? '',
  instagram: t.contacts?.instagram ?? '',
  vk: t.contacts?.vk ?? '',
  telegram: t.contacts?.telegram ?? '',
  whatsapp: t.contacts?.whatsapp ?? '',
  workingHours: t.workingHours ?? '',
})

const form = reactive(buildForm(props.tenant))

watch(() => props.tenant, (t) => Object.assign(form, buildForm(t)))

const saving = ref(false)
const { success } = useMessage()

const handleSave = async () => {
  saving.value = true
  try {
    await tenantStore.update({
      name: form.name,
      contacts: {
        phoneMode: form.phoneMode as 'shared' | 'per_branch',
        phone: form.phoneMode === 'shared' ? form.phone : '',
        email: form.email,
        address: '',
        instagram: form.instagram || null,
        vk: form.vk || null,
        telegram: form.telegram || null,
        whatsapp: form.whatsapp || null,
      },
      workingHours: form.workingHours,
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

.footer {
  @include settings-footer;
}
</style>
