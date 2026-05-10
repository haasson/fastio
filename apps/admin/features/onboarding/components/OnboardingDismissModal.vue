<template>
  <UiModal
    :model-value="show"
    title="Скрыть чек-лист?"
    :actions="actions"
    :on-confirm="onConfirm"
    :on-decline="onDecline"
    @update:model-value="(v: boolean) => emit('update:show', v)"
  >
    <UiText>
      Чек-лист больше не появится. Если что-то забудешь — загляни в базу знаний.
    </UiText>
  </UiModal>
</template>

<script setup lang="ts">
import { UiModal, UiText, type ModalAction } from '@fastio/ui'

defineProps<{ show: boolean }>()
const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'confirm'): void
}>()

const actions: ModalAction[] = [
  { text: 'Отмена', type: 'default', actionType: 'decline' },
  { text: 'Скрыть', type: 'error', actionType: 'confirm' },
]

const onConfirm = () => {
  emit('confirm')
}

const onDecline = () => {
  emit('update:show', false)
}
</script>
