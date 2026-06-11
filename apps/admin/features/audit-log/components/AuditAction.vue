<template>
  <span class="action" :class="meta.tone">
    <span v-if="dot" class="dot" data-testid="action-dot" />
    <UiText
      span
      size="tiny"
      class="label"
      data-testid="action-label"
    >{{ meta.label }}</UiText>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiText } from '@fastio/ui'
import { actionMeta } from '../utils/audit-labels'

const props = withDefaults(defineProps<{
  action: string
  dot?: boolean
}>(), {
  dot: true,
})

const meta = computed(() => actionMeta(props.action))
</script>

<style scoped lang="scss">
.action {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
}

.dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;

  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  border-radius: 50%;
  background: var(--color-text-hint);
}

.label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-hint);
}

.success {
  .dot { background: var(--green-500); }
  .label { color: var(--green-500); }
}

.error {
  .dot { background: var(--red-500); }
  .label { color: var(--red-500); }
}

.warning {
  .dot { background: var(--orange-400); }
  .label { color: var(--orange-400); }
}
</style>
