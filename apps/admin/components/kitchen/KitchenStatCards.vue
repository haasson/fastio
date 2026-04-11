<template>
  <div class="stat-cards-root">
    <UiCard
      v-for="item in items"
      :key="item.key"
      size="small"
      clickable
      class="stat"
      :class="[item.variant && `stat--${item.variant}`, { active: item.active }]"
      @click="$emit('select', item.key)"
    >
      <span class="stat-value" :class="item.color && `stat-value--${item.color}`">{{ item.value }}</span>
      <span class="stat-label">{{ item.label }}</span>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { UiCard } from '@fastio/ui'

export type StatCardItem = {
  key: string
  label: string
  value: number
  active?: boolean
  color?: 'green' | 'orange' | 'red'
  variant?: 'warning' | 'critical'
}

defineProps<{
  items: StatCardItem[]
}>()

defineEmits<{
  select: [key: string]
}>()
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.stat-cards-root {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;

  @include mq-m {
    display: flex;
  }
}

.stat {
  align-items: center;
  gap: 4px;
  padding: 16px 20px;
  transition: all 0.2s;

  &.active {
    box-shadow: 0 0 0 2px var(--color-primary);
  }

  &--warning {
    border: 1px solid var(--color-warning);

    &.active {
      box-shadow: 0 0 0 2px var(--color-warning);
    }
  }

  &--critical {
    border: 1px solid var(--color-error);

    &.active {
      box-shadow: 0 0 0 2px var(--color-error);
    }
  }
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-title);
  line-height: 1;

  &--green { color: var(--color-success); }
  &--orange { color: var(--color-warning); }
  &--red { color: var(--color-error); }
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-hint);
}
</style>
