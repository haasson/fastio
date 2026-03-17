<template>
  <ToastRoot
    class="sf-toast-root"
    :open="open"
    :duration="duration"
    @update:open="emit('update:open', $event)"
  >
    <component
      :is="icon"
      v-if="icon"
      class="sf-toast-icon"
      :size="20"
      :color="iconColor"
    />

    <div class="sf-toast-body">
      <ToastTitle v-if="title" class="sf-toast-title">{{ title }}</ToastTitle>
      <ToastDescription v-if="description" class="sf-toast-desc">{{ description }}</ToastDescription>
    </div>

    <ToastClose class="sf-toast-close" aria-label="Закрыть">
      <X :size="16" />
    </ToastClose>
  </ToastRoot>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { ToastRoot, ToastTitle, ToastDescription, ToastClose } from 'reka-ui'
import { X, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-vue-next'

type Props = {
  open: boolean
  title?: string
  description?: string
  variant?: 'default' | 'success' | 'error' | 'warning'
  duration?: number
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  duration: 4000,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const icon = computed(() => {
  switch (props.variant) {
    case 'success': return CheckCircle
    case 'error': return AlertCircle
    case 'warning': return AlertTriangle
    default: return null
  }
})

const iconColor = computed(() => {
  switch (props.variant) {
    case 'success': return 'var(--color-success, #10b981)'
    case 'error': return 'var(--color-error, #ef4444)'
    case 'warning': return 'var(--color-warning, #f59e0b)'
    default: return undefined
  }
})
</script>
<style lang="scss">
.sf-toast-root {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-card);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card-md, var(--shadow-card));
  font-family: var(--font-family);
  pointer-events: all;
  max-width: 400px;

  &[data-state='open'] { animation: sf-toast-in 0.2s ease; }
  &[data-state='closed'] { animation: sf-toast-out 0.15s ease; }
  &[data-swipe='move'] { transform: translateX(var(--reka-toast-swipe-move-x)); }
  &[data-swipe='end'] { animation: sf-toast-swipe-out 0.1s ease; }
}

@keyframes sf-toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes sf-toast-out {
  from { opacity: 1; }
  to { opacity: 0; transform: translateY(4px); }
}

@keyframes sf-toast-swipe-out {
  from { transform: translateX(var(--reka-toast-swipe-end-x)); }
  to { transform: translateX(100%); opacity: 0; }
}

.sf-toast-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.sf-toast-body {
  flex: 1;
  min-width: 0;
}

.sf-toast-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.sf-toast-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 2px 0 0;
}

.sf-toast-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: var(--radius-btn);
  flex-shrink: 0;
  transition: background 0.15s;

  &:hover { background: var(--surface-hover); }
}
</style>
