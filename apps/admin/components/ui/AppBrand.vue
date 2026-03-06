<template>
  <div class="brand-root" :class="`size-${size}`">
    <UiAppLogo :size="iconSize" />
    <span class="text">Fastio</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiAppLogo from './AppLogo.vue'

const props = withDefaults(defineProps<{
  size?: 'small' | 'medium'
}>(), {
  size: 'medium',
})

const iconSize = computed(() => props.size === 'small' ? 28 : 32)
</script>

<style scoped lang="scss">
.brand-root {
  display: flex;
  align-items: center;
  gap: 10px;

  .text {
    font-weight: 700;
    color: var(--color-title);
  }

  &.size-medium .text {
    font-size: 18px;
  }

  &.size-small .text {
    font-size: 16px;
  }
}
</style>
