<template>
  <ui-modal
    name="__confirm__"
    :title="options.title"
    :width="options.width"
    :actions="actions"
    :closable="options.closable"
    :stacked-actions="options.stackedActions"
    :reverse-actions="options.reverseActions"
  >
    <p v-if="options.message" class="confirm-message">{{ options.message }}</p>
  </ui-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiModal from './UiModal.vue'
import { confirmState } from '../composables/useConfirm'
import type { ModalAction } from './UiModal.vue'

const options = computed(() => confirmState.currentOptions.value)

const actions = computed<ModalAction[]>(() => {
  const result: ModalAction[] = []

  if (options.value.cancelText !== false) {
    result.push({
      text: options.value.cancelText || 'Отменить',
      type: options.value.cancelType || 'default',
      actionType: 'decline',
    })
  }

  if (options.value.confirmText !== false) {
    result.push({
      text: options.value.confirmText || 'Подтвердить',
      type: options.value.confirmType || 'primary',
      actionType: 'confirm',
    })
  }

  return result
})
</script>

<style scoped lang="scss">
.confirm-message {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  color: var(--color-text);
}
</style>
