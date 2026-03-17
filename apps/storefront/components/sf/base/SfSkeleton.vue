<template>
  <span
    class="skeleton-root"
    :class="[
      `skeleton-${variant}`,
      { 'is-rounded': rounded },
    ]"
    :style="{
      width: computedWidth,
      height: defaultHeight,
    }"
    aria-hidden="true"
  />
</template>
<script setup lang="ts">
import { computed } from 'vue'

type Props = {
  variant?: 'line' | 'circle' | 'rect'
  width?: string
  height?: string
  rounded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'line',
  width: '100%',
  rounded: false,
})

const defaultHeight = computed(() => {
  if (props.height) return props.height
  if (props.variant === 'line') return '16px'
  if (props.variant === 'circle') return props.width === '100%' ? '40px' : props.width
  return 'auto'
})

const computedWidth = computed(() => {
  if (props.variant === 'circle' && props.width === '100%') return '40px'
  return props.width
})
</script>
<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;
.skeleton-root {
  display: block;
  background: linear-gradient(
    90deg,
    var(--color-surface) 25%,
    color-mix(in srgb, var(--color-surface) 60%, var(--color-border)) 50%,
    var(--color-surface) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

// Variants
.skeleton-line {
  border-radius: 4px;
}

.skeleton-circle {
  border-radius: 50%;
  flex-shrink: 0;
}

.skeleton-rect {
  border-radius: 0;
}

// Rounded modifier (для rect)
.is-rounded {
  border-radius: var(--radius-card);
}

@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
</style>
