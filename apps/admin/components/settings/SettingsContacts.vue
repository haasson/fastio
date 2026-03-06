<template>
  <UiForm class="form" @submit="handleSave">
    <UiText size="tiny" span class="section-title">Основное</UiText>

    <UiInput v-model="form.name" label="Название заведения *" placeholder="Пицца Васи" />

    <div class="row">
      <UiInput v-model="form.phone" label="Телефон *" placeholder="+7 (999) 000-00-00" />
      <UiInput v-model="form.email" label="Email" placeholder="info@vasya-pizza.ru" />
    </div>

    <UiInput v-model="form.address" label="Адрес" placeholder="Москва, ул. Пушкина, д. 1" />

    <UiText size="tiny" span class="section-title">Соцсети и мессенджеры</UiText>

    <div class="row">
      <UiInput v-model="form.instagram" label="Instagram" placeholder="@vasya_pizza" />
      <UiInput v-model="form.vk" label="ВКонтакте" placeholder="vk.com/vasya_pizza" />
    </div>

    <div class="row">
      <UiInput v-model="form.telegram" label="Telegram" placeholder="@vasya_pizza" />
      <UiInput v-model="form.whatsapp" label="WhatsApp" placeholder="+7 (999) 000-00-00" />
    </div>

    <UiText size="tiny" span class="section-title">Часы работы</UiText>

    <UiInput
      v-model="form.workingHours"
      label="Режим работы"
      type="textarea"
      :rows="2"
      placeholder="Пн–Пт 10:00–22:00, Сб–Вс 11:00–21:00"
    />

    <div class="footer">
      <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
    </div>
  </UiForm>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { UiForm, UiInput, UiButton, UiText, useMessage } from '@fastio/ui'
import type { Tenant } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'

const props = defineProps<{ tenant: Tenant }>()

const tenantStore = useTenantStore()

const buildForm = (t: Tenant) => ({
  name: t.name ?? '',
  phone: t.contacts?.phone ?? '',
  email: t.contacts?.email ?? '',
  address: t.contacts?.address ?? '',
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
        phone: form.phone,
        email: form.email,
        address: form.address,
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
@use '@fastio/ui/styles/mixins/form' as *;

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-title {
  @include section-title;
  padding-top: 4px;
}

.row {
  @include form-row;
}

.footer {
  @include settings-footer;
  margin-top: 8px;
}

</style>
