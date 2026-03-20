<template>
  <svg
    class="spinner-root"
    :class="`spinner-${size}`"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle
      class="track"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      stroke-width="2.5"
    />
    <path
      class="arc"
      d="M12 2a10 10 0 0 1 10 10"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
    />
  </svg>
</template>
<script setup lang="ts">
type Props = {
  size?: 'small' | 'medium' | 'large'
}

withDefaults(defineProps<Props>(), {
  size: 'medium',
})
</script>
<style scoped lang="scss">
.spinner-root {
  display: inline-block;
  flex-shrink: 0;
  animation: spin 0.75s linear infinite;

  .track {
    opacity: 0.2;
  }
}

.spinner-small  { width: 16px; height: 16px; }
.spinner-medium { width: 24px; height: 24px; }
.spinner-large  { width: 32px; height: 32px; }

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
