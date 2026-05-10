<template>
  <UiModal
    :model-value="show"
    title="Начать заново?"
    :actions="actions"
    :on-confirm="onConfirm"
    :on-decline="onDecline"
    @update:model-value="(v: boolean) => emit('update:show', v)"
  >
    <UiText>
      Все отметки в чек-листе сбросятся. Данные в меню, заказах и настройках не пострадают.
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
  { text: 'Начать заново', type: 'primary', actionType: 'confirm' },
]

const onConfirm = () => emit('confirm')
const onDecline = () => emit('update:show', false)
</script>
