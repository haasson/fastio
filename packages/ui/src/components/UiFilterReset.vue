<template>
  <div v-if="count > 0" class="filter-reset-root">
    <UiButton ghost size="medium" @click="$emit('reset')">Сбросить фильтры</UiButton>
    <UiCounter :value="count" type="primary" size="tiny" solid class="counter" />
  </div>
</template>

<script setup lang="ts">
import UiButton from './UiButton.vue'
import UiCounter from './UiCounter.vue'

defineProps<{ count: number }>()
defineEmits<{ reset: [] }>()
</script>

<style scoped lang="scss">
.filter-reset-root {
  position: relative;
  display: inline-flex;
}

.counter {
  position: absolute;
  top: -6px;
  right: -6px;
  pointer-events: none;
}
</style>
