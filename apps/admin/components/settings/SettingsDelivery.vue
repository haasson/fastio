<template>
  <form @submit.prevent="handleSave">
    <div class="form">
      <p class="section-title">Настройки доставки</p>

      <div class="row">
        <div class="field">
          <UiInputNumber v-model="form.deliveryMinOrder" label="Минимальная сумма заказа, ₽" :min="0" placeholder="500" />
          <span class="hint">При сумме ниже — заказ не принимается</span>
        </div>
        <div class="field">
          <UiInputNumber v-model="form.deliveryFee" label="Стоимость доставки, ₽" :min="0" placeholder="150" />
          <span class="hint">0 — бесплатная доставка</span>
        </div>
      </div>

      <div class="footer">
        <span v-if="saved" class="saved-msg">✅ Сохранено</span>
        <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { UiButton, UiInputNumber } from '@fastio/ui'
import type { Tenant } from '@fastio/shared'

const props = defineProps<{ tenant: Tenant }>()
const emit = defineEmits<{ save: [data: Partial<Tenant>] }>()

const form = reactive({
  deliveryMinOrder: (props.tenant.deliveryMinOrder ?? null) as number | null,
  deliveryFee: (props.tenant.deliveryFee ?? null) as number | null,
})

watch(() => props.tenant, (t) => {
  form.deliveryMinOrder = t.deliveryMinOrder ?? null
  form.deliveryFee = t.deliveryFee ?? null
})

const saving = ref(false)
const saved = ref(false)

async function handleSave() {
  saving.value = true
  saved.value = false
  try {
    await emit('save', { deliveryMinOrder: form.deliveryMinOrder ?? 0, deliveryFee: form.deliveryFee ?? 0 })
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
  gap: 20px;
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
  gap: 16px;

  @include mq-m {
    grid-template-columns: 1fr 1fr;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.hint {
  font-size: 12px;
  color: #aaa;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.saved-msg {
  font-size: 13px;
  color: #10b981;
}
</style>
