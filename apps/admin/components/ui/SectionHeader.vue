<template>
  <div class="section-header-root">
    <div class="left">
      <span class="label">{{ title }}</span>
      <slot name="left" />
    </div>
    <div class="right">
      <slot name="right" />
      <UiButton
        v-if="editable"
        type="text"
        size="tiny"
        icon="pencil"
        class="edit-btn"
        @click="$emit('edit')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiButton } from '@fastio/ui'

withDefaults(defineProps<{
  title: string
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
  justify-content: space-between;
  gap: 12px;
}

.left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.edit-btn {
  opacity: 0.5;
  transition: opacity 0.15s;

  &:hover { opacity: 1; }
}
</style>
