<template>
  <svg
    class="app-logo"
    :width="size"
    :height="size"
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="48" height="48" rx="12" :fill="background" />
    <path d="M20 6h10l-4 16h8L18 42l4-16h-8z" :fill="color" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  size?: number
  color?: string
  background?: string
}>(), {
  size: 28,
  color: '#ffffff',
  background: '#ff6b35',
})
</script>
