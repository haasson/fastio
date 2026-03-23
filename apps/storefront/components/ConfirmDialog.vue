<template>
  <FsDialog
    :model-value="state.open"
    :title="state.title"
    size="sm"
    :closable="false"
    @update:model-value="onCancel"
  >
    <p class="message">{{ state.message }}</p>
    <template #footer>
      <FsButton variant="ghost" @click="onCancel">{{ state.cancelLabel }}</FsButton>
      <FsButton :variant="state.danger ? 'destructive' : 'primary'" @click="onConfirm">
        {{ state.confirmLabel }}
      </FsButton>
    </template>
  </FsDialog>
</template>

<script setup lang="ts">
import { FsDialog, FsButton } from '@fastio/public-ui'
import { useConfirm } from '~/composables/useConfirm'

const { state, onConfirm, onCancel } = useConfirm()
</script>

<style scoped lang="scss">
.message {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}
</style>
