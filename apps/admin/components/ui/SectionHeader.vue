<template>
  <div class="section-header-root">
    <span class="left">
      <span class="label">{{ label }}</span>
      <UiButton
        v-if="editable"
        type="text"
        size="tiny"
        icon="pencil"
        class="edit-btn"
        @click="$emit('edit')"
      />
    </span>
    <span class="right">
      <slot />
    </span>
  </div>
</template>

<script setup lang="ts">
import { UiButton } from '@fastio/ui'

withDefaults(defineProps<{
  label: string
  editable?: boolean
}>(), {
  editable: false,
})

defineEmits<{
  edit: []
}>()
</script>

<style scoped lang="scss">
.section-header-root {
  display: flex;
  align-items: center;
  gap: 10px;
}

.left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.edit-btn {
  opacity: 0.5;
  transition: opacity 0.15s;

  &:hover {
    opacity: 1;
  }
}
</style>
