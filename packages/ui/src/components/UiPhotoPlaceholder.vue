<template>
  <div class="placeholder-root">
    <svg
      :width="iconSize"
      :height="iconSize"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Plate circle -->
      <circle cx="24" cy="24" r="16" stroke="currentColor" stroke-width="1.5" opacity="0.5" />
      <circle cx="24" cy="24" r="11" stroke="currentColor" stroke-width="1" opacity="0.3" />
      <!-- Fork (left) -->
      <path
        d="M15 10v6M13 10v6M17 10v6M15 16v5a1 1 0 0 0 1 1h0a1 1 0 0 0 1-1v-5"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.6"
      />
      <!-- Knife (right) -->
      <path
        d="M31 10v12a1 1 0 0 0 2 0v-4h0c1.1 0 2-.9 2-2v-5a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1z"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="currentColor"
        fill-opacity="0.08"
        opacity="0.6"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: 'small' | 'medium' | 'large'
}>(), { size: 'medium' })

const iconSize = computed(() => {
  const map = { small: 28, medium: 56, large: 80 }
  return map[props.size]
})
</script>

<style scoped lang="scss">
.placeholder-root {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  /* stylelint-disable scale-unlimited/declaration-strict-value, color-no-hex */
  background: linear-gradient(145deg, #f8f9fb 0%, #eef0f4 100%);
  color: #c0c7d1;
  /* stylelint-enable */
}
</style>
