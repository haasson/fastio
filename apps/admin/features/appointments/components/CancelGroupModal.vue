<template>
  <UiModal
    v-model="open"
    title="Отменить группу?"
    :loading="loading"
    :on-confirm="onConfirm"
    :actions="[
      { text: 'Назад', actionType: 'decline' },
      { text: 'Подтвердить отмену', actionType: 'confirm', type: 'error' },
    ]"
  >
    <UiText size="small" class="cancel-warning">
      Все услуги в группе будут отменены. Это действие нельзя отменить через UI.
    </UiText>
    <UiInput
      v-model="reason"
      type="textarea"
      placeholder="Причина отмены (необязательно)"
      class="cancel-reason-input"
      :rows="3"
    />
  </UiModal>
</template>

<script setup lang="ts">
import { UiModal, UiText, UiInput } from '@fastio/ui'

defineProps<{
  loading: boolean
  onConfirm: () => Promise<boolean | void>
}>()

const open = defineModel<boolean>({ required: true })
const reason = defineModel<string>('reason', { required: true })
</script>

<style scoped lang="scss">
.cancel-warning {
  color: var(--color-text-secondary);
  margin-bottom: var(--space-12);
  display: block;
}

.cancel-reason-input {
  width: 100%;
}
</style>
