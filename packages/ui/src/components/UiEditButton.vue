<template>
  <UiButton
    type="text"
    size="tiny"
    icon="pencil"
    class="edit-button-root"
    @click="$emit('click')"
  />
</template>

<script setup lang="ts">
import UiButton from './UiButton.vue'

defineEmits<{ click: [] }>()
</script>

<style scoped lang="scss">
.edit-button-root {
  opacity: 0.4;
  transition: opacity 0.15s;

  &:hover { opacity: 1; }
}
</style>
