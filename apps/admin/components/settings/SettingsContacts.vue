<template>
  <form @submit.prevent="handleSave">
    <div class="form">
      <p class="section-title">Контактная информация</p>

      <UiInput v-model="form.name" label="Название заведения *" placeholder="Пицца Васи" />

      <div class="row">
        <UiInput v-model="form.phone" label="Телефон *" placeholder="+7 (999) 000-00-00" />
        <UiInput v-model="form.email" label="Email" placeholder="info@vasya-pizza.ru" />
      </div>

      <div class="row">
        <UiInput v-model="form.city" label="Город" placeholder="Москва" />
        <UiInput v-model="form.address" label="Адрес" placeholder="ул. Пушкина, д. 1" />
      </div>

      <p class="section-title" style="margin-top: 8px;">Соцсети</p>

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
import { UiInput, UiButton } from '@fastio/ui'
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

async function handleSave() {
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
    setTimeout(() => { saved.value = false }, 3000)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/ui/styles/mixins/media-queries' as *;

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #aaa;
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
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.saved-msg {
  font-size: 13px;
  color: #10b981;
}
</style>
