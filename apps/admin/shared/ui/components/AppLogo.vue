<template>
  <img
    class="app-logo"
    src="/logo-mark.svg"
    :style="{ width: `${size}px` }"
    alt=""
  />
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  size?: number
}>(), {
  size: 28,
})
</script>
