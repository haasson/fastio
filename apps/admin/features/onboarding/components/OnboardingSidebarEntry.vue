<template>
  <button
    type="button"
    class="sidebar-entry"
    :class="{ active, done }"
    @click="emit('click')"
  >
    <span class="entry-icon">
      <UiIcon :name="done ? 'check' : 'sparkles'" :size="18" />
    </span>
    <span class="entry-label">
      <span class="entry-title">{{ done ? 'Всё готово' : 'Чек-лист' }}</span>
      <span v-if="!done" class="entry-progress">{{ completed }}/{{ total }} шагов</span>
    </span>
    <UiIcon name="chevronRight" :size="14" class="entry-chev" />
  </button>
</template>

<script setup lang="ts">
import { UiIcon } from '@fastio/ui'

defineProps<{
  active: boolean
  done: boolean
  completed: number
  total: number
}>()
const emit = defineEmits<{ (e: 'click'): void }>()
</script>

<style scoped lang="scss">
.sidebar-entry {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  width: 100%;
  padding: var(--space-12);
  margin-bottom: var(--space-8);
  border: 1px solid transparent;
  border-radius: var(--radius-8);
  background: color-mix(in srgb, var(--orange-600) 18%, transparent);
  color: var(--grey-50);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: color-mix(in srgb, var(--orange-600) 28%, transparent);
    border-color: var(--orange-500);
  }

  &.active {
    border-color: var(--orange-500);
    background: color-mix(in srgb, var(--orange-600) 35%, transparent);
  }

  &.done {
    background: color-mix(in srgb, var(--color-success) 22%, transparent);

    .entry-icon {
      background: var(--color-success);
    }

    &:hover {
      background: color-mix(in srgb, var(--color-success) 32%, transparent);
      border-color: var(--color-success);
    }
  }
}

.entry-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--orange-600);
  color: var(--color-white);
  flex-shrink: 0;
}

.entry-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.entry-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1.1;
}

.entry-progress {
  font-size: var(--font-size-xs);
  color: var(--grey-400);
  line-height: 1.1;
}

.entry-chev {
  color: var(--grey-400);
  flex-shrink: 0;
}
</style>
