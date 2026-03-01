<template>
  <form class="form" @submit.prevent="handleSave">
    <h3 class="section-title">Настройки доставки</h3>

    <div class="row">
      <div class="field">
        <label class="label">Минимальная сумма заказа, ₽</label>
        <input v-model.number="form.deliveryMinOrder" class="input" type="number" min="0" placeholder="500" />
        <span class="hint">При сумме ниже — заказ не принимается</span>
      </div>
      <div class="field">
        <label class="label">Стоимость доставки, ₽</label>
        <input v-model.number="form.deliveryFee" class="input" type="number" min="0" placeholder="150" />
        <span class="hint">0 — бесплатная доставка</span>
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
  deliveryMinOrder: props.tenant.deliveryMinOrder ?? 0,
  deliveryFee: props.tenant.deliveryFee ?? 0,
})

watch(() => props.tenant, (t) => {
  form.deliveryMinOrder = t.deliveryMinOrder ?? 0
  form.deliveryFee = t.deliveryFee ?? 0
})

const saving = ref(false)
const saved = ref(false)

async function handleSave() {
  saving.value = true
  saved.value = false
  try {
    await emit('save', { deliveryMinOrder: form.deliveryMinOrder, deliveryFee: form.deliveryFee })
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.form { display: flex; flex-direction: column; gap: 20px; }

.section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #aaa;
}

.row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.label { font-size: 13px; font-weight: 600; color: #555; }
.hint { font-size: 12px; color: #aaa; }

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

.footer { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
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
