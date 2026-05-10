<template>
  <button
    type="button"
    class="option"
    :class="{ selected }"
    @click="$emit('select')"
  >
    <UiIcon :name="icon" :size="28" class="option-icon" />
    <div class="option-body">
      <UiText size="medium" class="option-title">{{ title }}</UiText>
      <UiText size="small" class="option-desc">{{ desc }}</UiText>
    </div>
  </button>
</template>

<script setup lang="ts">
import { UiText, UiIcon } from '@fastio/ui'
import type { IconName } from '@fastio/icons'

defineProps<{
  icon: IconName
  title: string
  desc: string
  selected: boolean
}>()

defineEmits<{ select: [] }>()
</script>

<style scoped lang="scss">
.option {
  display: flex;
  align-items: center;
  gap: var(--space-16);
  padding: var(--space-16);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-12);
  background: var(--color-bg-card);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    border-color: var(--color-primary);
    background: var(--color-bg-hover);
  }

  &.selected {
    border-color: var(--color-primary);
    background: var(--color-bg-hover);
  }
}

.option-icon {
  flex-shrink: 0;
  color: var(--color-primary);
}

.option-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.option-title {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.option-desc {
  color: var(--color-text-secondary);
}
</style>
