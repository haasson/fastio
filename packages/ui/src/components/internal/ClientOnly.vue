<template>
  <div v-if="isMounted">
    <slot />
  </div>
  <div v-else>
    <slot name="fallback" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isMounted = ref(false)

onMounted(() => {
  isMounted.value = true
})
</script>
