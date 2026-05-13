<template>
  <UiCard class="stat-block-root">
    <UiText size="small" class="stat-label">{{ label }}</UiText>
    <div class="stat-value-wrap">
      <UiSkeleton v-if="loading" :width="loadingWidth" :height="32" />
      <UiTitle v-else size="h3" class="stat-value">
        <slot>{{ value }}</slot>
      </UiTitle>
    </div>
    <UiText v-if="sub || $slots.sub" size="small" class="stat-sub">
      <slot name="sub">{{ sub }}</slot>
    </UiText>
  </UiCard>
</template>

<script setup lang="ts">
import UiCard from './UiCard.vue'
import UiText from './UiText.vue'
import UiTitle from './UiTitle.vue'
import UiSkeleton from './UiSkeleton.vue'

withDefaults(defineProps<{
  label: string
  value?: string | number
  sub?: string
  loading?: boolean
  loadingWidth?: number | string
}>(), {
  loadingWidth: 100,
})
</script>

<style scoped lang="scss">
.stat-block-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.stat-label {
  color: var(--color-text-hint);
}

.stat-value-wrap {
  margin: var(--space-4) 0;
}

.stat-sub {
  color: var(--color-text-secondary);
}
</style>
