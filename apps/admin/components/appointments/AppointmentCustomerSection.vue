<template>
  <UiCard>
    <UiTitle size="h4" class="card-title">Клиент</UiTitle>
    <div class="form-grid">
      <UiInput
        v-model="customerName"
        label="Имя клиента"
        :disabled="disabled"
      />
      <UiInput
        v-model="customerPhone"
        label="Телефон"
        callable
        :disabled="disabled"
      />
      <UiInput
        v-model="customerEmail"
        label="Email"
        :disabled="disabled"
      />
      <UiInput
        v-model="notes"
        label="Примечание"
        type="textarea"
        :rows="3"
        :disabled="disabled"
      />
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { UiCard, UiTitle, UiInput } from '@fastio/ui'

defineProps<{ disabled: boolean }>()

const customerName = defineModel<string>('customerName', { required: true })
const customerPhone = defineModel<string>('customerPhone', { required: true })
const customerEmail = defineModel<string>('customerEmail', { required: true })
const notes = defineModel<string>('notes', { required: true })
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.card-title {
  margin-bottom: var(--space-12);
}

.form-grid {
  @include flex-col(var(--space-12));
}
</style>
