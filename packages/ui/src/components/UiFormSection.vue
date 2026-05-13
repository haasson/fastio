<template>
  <UiCard :size="size" class="form-section-root">
    <UiSectionHeader v-if="title || $slots.title" :title="title ?? ''">
      <template v-if="$slots['header-right']" #right>
        <slot name="header-right" />
      </template>
      <template v-if="$slots['header-left']" #left>
        <slot name="header-left" />
      </template>
    </UiSectionHeader>
    <div v-if="description" class="form-section-desc">
      <UiText size="small">{{ description }}</UiText>
    </div>
    <div :class="['form-section-body', `cols-${columns}`]">
      <slot />
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import UiCard from './UiCard.vue'
import UiSectionHeader from './UiSectionHeader.vue'
import UiText from './UiText.vue'

// size — паддинги внутренней UiCard ('small'/'medium'/'large'), а не размер шрифта/типографики
// columns — responsive grid полей: всегда 1 col на мобиле, разворачивается на >=mq-m
withDefaults(defineProps<{
  title?: string
  description?: string
  size?: 'small' | 'medium' | 'large'
  columns?: 1 | 2 | 3
}>(), {
  size: 'large',
  columns: 2,
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.form-section-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.form-section-desc {
  color: var(--color-text-secondary);
}

.form-section-body {
  display: grid;
  gap: var(--space-16);

  &.cols-1 { grid-template-columns: 1fr; }

  &.cols-2 {
    grid-template-columns: 1fr;
    @include mq-m { grid-template-columns: repeat(2, 1fr); }
  }

  &.cols-3 {
    grid-template-columns: 1fr;
    @include mq-m { grid-template-columns: repeat(2, 1fr); }
    @include mq-l { grid-template-columns: repeat(3, 1fr); }
  }
}
</style>
