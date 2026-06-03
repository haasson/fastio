<template>
  <UiCard :size="size" class="form-section-root">
    <UiSectionHeader v-if="title || $slots.title" :title="title ?? ''">
      <template v-if="$slots['header-right']" #right>
        <slot name="header-right" />
      </template>
      <template v-if="help || $slots['header-left']" #left>
        <slot name="header-left" />
        <UiInfoTip v-if="help" :content="help" />
      </template>
    </UiSectionHeader>
    <div v-if="description" class="form-section-desc">
      <UiText size="tiny">{{ description }}</UiText>
    </div>
    <div v-if="hasBody" :class="['form-section-body', `cols-${columns}`]">
      <slot />
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { computed, useSlots, Comment, Text, Fragment, type VNode } from 'vue'
import UiCard from './UiCard.vue'
import UiSectionHeader from './UiSectionHeader.vue'
import UiText from './UiText.vue'
import UiInfoTip from './UiInfoTip.vue'

// size — паддинги внутренней UiCard ('small'/'medium'/'large'), а не размер шрифта/типографики
// columns — responsive grid полей: всегда 1 col на мобиле, разворачивается на >=mq-m
withDefaults(defineProps<{
  title?: string
  description?: string
  help?: string
  size?: 'small' | 'medium' | 'large'
  columns?: 1 | 2 | 3
}>(), {
  size: 'large',
  columns: 2,
})

const slots = useSlots()

// Пустой или скрытый (v-if) контент слота не должен оставлять фантомный gap под хедером:
// тело рендерим только если в слоте есть реальные ноды (не комментарии/пробелы).
const isSlotEmpty = (nodes?: VNode[]): boolean => {
  if (!nodes || !nodes.length) return true

  return nodes.every((n) => {
    if (n.type === Comment) return true
    if (n.type === Text) return typeof n.children !== 'string' || !n.children.trim()
    if (n.type === Fragment) return Array.isArray(n.children) ? isSlotEmpty(n.children as VNode[]) : false

    return false
  })
}

const hasBody = computed(() => !isSlotEmpty(slots.default?.()))
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.form-section-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  border: 1px solid var(--color-border);
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
