<template>
  <div class="stat-cards-root" data-tour="kitchen-stat-cards">
    <UiCard
      v-for="item in items"
      :key="item.key"
      size="small"
      clickable
      class="stat"
      :class="[item.variant && `stat--${item.variant}`, { active: item.active }]"
      :data-tour="item.variant ? `kitchen-stat-${item.variant}` : undefined"
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
  gap: var(--space-12);

  @include mq-m {
    display: flex;
  }
}

.stat {
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-16) var(--space-20);
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
  /* stylelint-disable scale-unlimited/declaration-strict-value */
  font-size: 28px;
  line-height: 1;
  /* stylelint-enable scale-unlimited/declaration-strict-value */
  font-weight: var(--font-weight-bold);
  color: var(--color-title);

  &--green { color: var(--color-success); }
  &--orange { color: var(--color-warning); }
  &--red { color: var(--color-error); }
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-hint);
}
</style>
