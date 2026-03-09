<template>
  <UiButton
    type="text"
    size="tiny"
    icon="pencil"
    class="edit-btn-root"
    @click="$emit('click')"
  />
</template>

<script setup lang="ts">
import { UiButton } from '@fastio/ui'

defineEmits<{
  click: []
}>()
</script>

<style scoped lang="scss">
.edit-btn-root {
  opacity: 0.4;
  transition: opacity 0.15s;

  &:hover { opacity: 1; }
}
</style>
