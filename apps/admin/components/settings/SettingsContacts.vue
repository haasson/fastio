<template>
  <form class="form" @submit.prevent="handleSave">
    <h3 class="section-title">Контактная информация</h3>

    <div class="field">
      <label class="label">Название заведения *</label>
      <input v-model="form.name" class="input" type="text" placeholder="Пицца Васи" required />
    </div>

    <div class="row">
      <div class="field">
        <label class="label">Телефон *</label>
        <input v-model="form.contacts.phone" class="input" type="tel" placeholder="+7 (999) 000-00-00" required />
      </div>
      <div class="field">
        <label class="label">Email</label>
        <input v-model="form.contacts.email" class="input" type="email" placeholder="info@vasya-pizza.ru" />
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label class="label">Город</label>
        <input v-model="form.contacts.city" class="input" type="text" placeholder="Москва" />
      </div>
      <div class="field">
        <label class="label">Адрес</label>
        <input v-model="form.contacts.address" class="input" type="text" placeholder="ул. Пушкина, д. 1" />
      </div>
    </div>

    <h3 class="section-title" style="margin-top: 8px;">Соцсети</h3>

    <div class="row">
      <div class="field">
        <label class="label">Instagram</label>
        <input v-model="form.contacts.instagram" class="input" type="text" placeholder="@vasya_pizza" />
      </div>
      <div class="field">
        <label class="label">ВКонтакте</label>
        <input v-model="form.contacts.vk" class="input" type="text" placeholder="vk.com/vasya_pizza" />
      </div>
    </div>

    <div class="footer">
      <span v-if="saved" class="saved-msg">✅ Сохранено</span>
      <button type="submit" class="btn-primary" :disabled="saving">
        {{ saving ? 'Сохранение…' : 'Сохранить' }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { Tenant } from '@fastfood-saas/shared'

const props = defineProps<{ tenant: Tenant }>()
const emit = defineEmits<{ save: [data: Partial<Tenant>] }>()

const form = reactive({
  name: props.tenant.name,
  contacts: { ...props.tenant.contacts },
})

watch(() => props.tenant, (t) => {
  form.name = t.name
  Object.assign(form.contacts, t.contacts)
})

const saving = ref(false)
const saved = ref(false)

async function handleSave() {
  saving.value = true
  saved.value = false
  try {
    await emit('save', { name: form.name, contacts: { ...form.contacts } })
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }

.section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #aaa;
  margin-bottom: -4px;
}

.row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.field { display: flex; flex-direction: column; gap: 5px; }

.label { font-size: 13px; font-weight: 600; color: #555; }

.input {
  height: 42px;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  padding: 0 12px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

.input:focus { border-color: #ff6b35; }

.footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.saved-msg { font-size: 13px; color: #10b981; }

.btn-primary {
  height: 40px;
  padding: 0 20px;
  background: #ff6b35;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}

.btn-primary:hover:not(:disabled) { background: #e55a25; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

@media (max-width: 480px) { .row { grid-template-columns: 1fr; } }
</style>
