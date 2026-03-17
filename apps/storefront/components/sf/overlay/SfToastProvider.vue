<template>
  <ToastProvider :duration="4000" swipe-direction="right">
    <SfToast
      v-for="toast in toasts"
      :key="toast.id"
      :open="toast.open"
      :title="toast.title"
      :description="toast.description"
      :variant="toast.variant"
      :duration="toast.duration"
      @update:open="(val) => !val && useToast().dismiss(toast.id)"
    />

    <ToastViewport class="sf-toast-viewport" />
  </ToastProvider>
</template>
<script setup lang="ts">
import { ToastProvider, ToastViewport } from 'reka-ui'
import SfToast from '~/components/sf/overlay/SfToast.vue'
import { useToast } from '~/composables/useToast'

const { toasts } = useToast()
</script>
<style lang="scss">
@use '~/assets/styles/mixins' as *;

.sf-toast-viewport {
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
