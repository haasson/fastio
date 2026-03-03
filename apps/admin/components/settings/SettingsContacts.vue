<template>
  <form @submit.prevent="handleSave">
    <div class="form">
      <UiText size="tiny" span class="section-title">Контактная информация</UiText>

      <UiInput v-model="form.name" label="Название заведения *" placeholder="Пицца Васи" />

      <div class="row">
        <UiInput v-model="form.phone" label="Телефон *" placeholder="+7 (999) 000-00-00" />
        <UiInput v-model="form.email" label="Email" placeholder="info@vasya-pizza.ru" />
      </div>

      <div class="row">
        <UiInput v-model="form.city" label="Город" placeholder="Москва" />
        <UiInput v-model="form.address" label="Адрес" placeholder="ул. Пушкина, д. 1" />
      </div>

      <UiText
        size="tiny"
        span
        class="section-title"
        style="margin-top: 8px;"
      >Соцсети</UiText>

      <div class="row">
        <UiInput v-model="form.instagram" label="Instagram" placeholder="@vasya_pizza" />
        <UiInput v-model="form.vk" label="ВКонтакте" placeholder="vk.com/vasya_pizza" />
      </div>

      <div class="footer">
        <span v-if="saved" class="saved-msg">✅ Сохранено</span>
        <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { UiInput, UiButton, UiText } from '@fastio/ui'
import type { Tenant } from '@fastio/shared'

const props = defineProps<{ tenant: Tenant }>()
const emit = defineEmits<{ save: [data: Partial<Tenant>] }>()

const form = reactive({
  name: props.tenant.name ?? '',
  phone: props.tenant.contacts?.phone ?? '',
  email: props.tenant.contacts?.email ?? '',
  city: props.tenant.contacts?.city ?? '',
  address: props.tenant.contacts?.address ?? '',
  instagram: props.tenant.contacts?.instagram ?? '',
  vk: props.tenant.contacts?.vk ?? '',
})

watch(() => props.tenant, (t) => {
  form.name = t.name ?? ''
  form.phone = t.contacts?.phone ?? ''
  form.email = t.contacts?.email ?? ''
  form.city = t.contacts?.city ?? ''
  form.address = t.contacts?.address ?? ''
  form.instagram = t.contacts?.instagram ?? ''
  form.vk = t.contacts?.vk ?? ''
})

const saving = ref(false)
const saved = ref(false)

const handleSave = async () => {
  saving.value = true
  saved.value = false
  try {
    await emit('save', {
      name: form.name,
      contacts: {
        phone: form.phone,
        email: form.email,
        city: form.city,
        address: form.address,
        instagram: form.instagram,
        vk: form.vk,
      },
    })
    saved.value = true
    setTimeout(() => {
      saved.value = false
    }, 3000)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/ui/styles/mixins/media-queries' as *;
@use '@fastio/ui/styles/mixins/form' as *;

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-title {
  @include section-title;
}

.row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;

  @include mq-m {
    grid-template-columns: 1fr 1fr;
  }
}

.footer {
  @include settings-footer;
  margin-top: 8px;
}

.saved-msg {
  @include saved-msg;
}
</style>
