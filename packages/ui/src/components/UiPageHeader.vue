<template>
  <header class="page-header-root" :class="`size-${size}`">
    <div class="page-header-text">
      <UiTitle v-if="title || $slots.title" :size="size === 'large' ? 'h2' : 'h3'" tag="h1">
        <slot name="title">{{ title }}</slot>
      </UiTitle>
      <UiText v-if="description || $slots.description" size="small" class="page-header-desc">
        <slot name="description">{{ description }}</slot>
      </UiText>
    </div>
    <div v-if="$slots.actions" class="page-header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
import UiTitle from './UiTitle.vue'
import UiText from './UiText.vue'

withDefaults(defineProps<{
  title?: string
  description?: string
  size?: 'medium' | 'large'
}>(), {
  size: 'medium',
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.page-header-root {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-12);
  margin-bottom: var(--space-16);

  @include mq-l {
    align-items: center;
  }
}

.page-header-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.page-header-desc {
  color: var(--color-text-secondary);
}

.page-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-shrink: 0;
}

.size-large {
  margin-bottom: var(--space-24);
}
</style>
