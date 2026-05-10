<template>
  <div class="row-root">
    <div class="inner">
      <div class="header" :class="{ clickable: hasOptions }" @click="hasOptions && (open = !open)">
        <span class="label">{{ label }}</span>
        <UiIcon
          v-if="hasOptions"
          name="chevronRound"
          :size="24"
          class="arrow"
          :class="{ open }"
        />
      </div>

      <div v-if="hasOptions && open" class="options">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, useSlots, computed } from 'vue'
import { UiIcon } from '@fastio/ui'

defineProps<{
  label: string
}>()

const slots = useSlots()
const hasOptions = computed(() => !!slots.default)
const open = ref(false)
</script>

<style scoped lang="scss">
.row-root {
  border-top: 1px solid var(--color-border);
  padding: var(--space-16) 0;

  &:first-child {
    border-top: none;
    padding-top: 0;
  }
}

.inner {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--space-8);

  &.clickable {
    cursor: pointer;
    user-select: none;
  }
}

.label {
  flex: 1;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.arrow {
  color: var(--color-text-secondary);
  transition: transform 0.2s;
  flex-shrink: 0;
  transform: rotate(-90deg);

  &.open {
    transform: rotate(0deg);
  }
}

.options {
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-8);
  padding: var(--space-12);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}
</style>
