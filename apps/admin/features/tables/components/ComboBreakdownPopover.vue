<template>
  <UiPopover :width="220" inline-trigger>
    <template #trigger>
      <UiButton
        size="small"
        type="text"
        icon="help"
        class="combo-hint-trigger"
      />
    </template>
    <div class="combo-breakdown">
      <div class="breakdown-title">Состав комбо</div>
      <div v-for="child in children" :key="child.dishName" class="breakdown-row">
        <span class="dot" :class="dotClass(child.status)" />
        <span class="name">{{ child.dishName }}</span>
        <span v-if="child.total > 1" class="qty">×{{ child.total }}</span>
        <span class="state" :class="`state--${child.status}`">{{ STATE_LABELS[child.status] }}</span>
      </div>
    </div>
  </UiPopover>
</template>

<script setup lang="ts">
import { UiPopover, UiButton } from '@fastio/ui'
import type { KitchenProgressChild } from '~/features/kitchen'

type Props = {
  children: KitchenProgressChild[]
}

defineProps<Props>()

const STATE_LABELS: Record<KitchenProgressChild['status'], string> = {
  queued: 'в очереди',
  in_progress: 'готовится',
  done: 'готово',
}

const dotClass = (status: KitchenProgressChild['status']) => status === 'in_progress'
  ? 'dot--cooking'
  : status === 'done'
    ? 'dot--ready'
    : 'dot--queued'
</script>

<style scoped lang="scss">
.combo-hint-trigger {
  flex-shrink: 0;
  color: var(--color-text-hint);
}

.combo-breakdown {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.breakdown-title {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-hint);
  margin-bottom: var(--space-4);
}

.breakdown-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;

  &.dot--queued  { background: var(--color-primary); }
  &.dot--cooking { background: var(--color-warning); }
  &.dot--ready   { background: var(--color-success); }
}

.name {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-sm);
  color: var(--color-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qty {
  font-size: var(--font-size-sm);
  color: var(--color-text-hint);
  flex-shrink: 0;
}

.state {
  font-size: var(--font-size-xs);
  flex-shrink: 0;

  &--queued      { color: var(--color-text-hint); }
  &--in_progress { color: var(--color-warning); }
  &--done        { color: var(--color-success); }
}
</style>
