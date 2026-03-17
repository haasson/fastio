<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      :fill="colored ? BRAND_COLOR : 'currentColor'"
      d="M19 2H5a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h3v3l5-3h6a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3z"
    />
  </svg>
</template>

<script setup lang="ts">
// MAX messenger (VK Group) — синефиолетовый бренд
const BRAND_COLOR = '#6057E8'

withDefaults(defineProps<{ size?: number; colored?: boolean }>(), {
  size: 24,
  colored: false,
})
</script>
