<template>
  <UiForm @submit="handleSave">
    <div class="form">
      <UiSectionHeader title="Настройки доставки" />

      <div class="row">
        <UiInputNumber
          v-model="form.deliveryMinOrder"
          label="Минимальная сумма заказа, ₽"
          message="При сумме ниже — заказ не принимается"
          :min="0"
          placeholder="500"
        />
        <UiInputNumber
          v-model="form.deliveryFee"
          label="Стоимость доставки, ₽"
          message="0 — бесплатная доставка"
          :min="0"
          placeholder="150"
        />
        <UiInputNumber
          v-model="form.freeDeliveryFrom"
          label="Бесплатная доставка от, ₽"
          message="0 — без порога бесплатной доставки"
          :min="0"
          placeholder="1500"
        />
      </div>

      <div class="footer">
        <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
      </div>
    </div>
  </UiForm>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { UiForm, UiButton, UiInputNumber, useMessage, UiSectionHeader } from '@fastio/ui'
import type { Tenant } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'

const props = defineProps<{ tenant: Tenant }>()

const tenantStore = useTenantStore()

const buildForm = (t: Tenant) => ({
  deliveryMinOrder: (t.deliveryMinOrder ?? null) as number | null,
  deliveryFee: (t.deliveryFee ?? null) as number | null,
  freeDeliveryFrom: (t.freeDeliveryFrom ?? null) as number | null,
})

const form = reactive(buildForm(props.tenant))

watch(() => props.tenant, (t) => Object.assign(form, buildForm(t)))

const saving = ref(false)
const { success } = useMessage()

const handleSave = async () => {
  saving.value = true
  try {
    await tenantStore.update({ deliveryMinOrder: form.deliveryMinOrder ?? 0, deliveryFee: form.deliveryFee ?? 0, freeDeliveryFrom: form.freeDeliveryFrom ?? 0 })
    success('Сохранено')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/form' as *;

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-20);
}

.row {
  @include form-row(16px);
}

.footer {
  @include settings-footer;
}

</style>
