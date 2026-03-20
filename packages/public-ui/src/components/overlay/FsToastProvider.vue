<template>
  <ToastProvider :duration="4000" swipe-direction="right">
    <FsToast
      v-for="toast in toasts"
      :key="toast.id"
      :open="toast.open"
      :title="toast.title"
      :description="toast.description"
      :variant="toast.variant"
      :duration="toast.duration"
      @update:open="(val) => !val && onDismiss?.(toast.id)"
    />

    <ToastViewport class="fs-toast-viewport" />
  </ToastProvider>
</template>
<script setup lang="ts">
import { ToastProvider, ToastViewport } from 'reka-ui'
import FsToast from './FsToast.vue'

type ToastItem = {
  id: string | number
  open: boolean
  title?: string
  description?: string
  variant?: 'default' | 'success' | 'error' | 'warning'
  duration?: number
}

type Props = {
  toasts: ToastItem[]
  onDismiss?: (id: string | number) => void
}

defineProps<Props>()
</script>
<style lang="scss">
@use '../../styles/mixins' as *;

.fs-toast-viewport {
  position: fixed;
  bottom: 16px;
  right: 16px;
  left: 16px;
  z-index: var(--z-toast, 500);
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 400px;
  margin-left: auto;
  pointer-events: none;

  @include md {
    left: auto;
    min-width: 320px;
  }
}
</style>
