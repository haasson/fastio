<template>
  <div class="kv-root" :class="`align-${align}`">
    <UiText size="small" class="kv-label">
      <slot name="label">{{ label }}</slot>
    </UiText>
    <component :is="valueTag" class="kv-value">
      <slot>{{ value }}</slot>
    </component>
  </div>
</template>

<script setup lang="ts">
import UiText from './UiText.vue'

// align='inline' — на десктопе label слева / value справа, на мобиле стек.
// align='stacked' — label всегда сверху над value.
withDefaults(defineProps<{
  label: string
  value?: string | number | null
  align?: 'inline' | 'stacked'
  valueTag?: 'span' | 'div' | 'time' | 'a' | 'p'
}>(), {
  align: 'inline',
  valueTag: 'span',
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.kv-root {
  display: flex;
  gap: var(--space-12);
  min-width: 0;
}

.kv-label {
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.kv-value {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.align-inline {
  flex-direction: column;

  @include mq-m {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;

    .kv-value { text-align: right; }
  }
}

.align-stacked {
  flex-direction: column;
}
</style>
