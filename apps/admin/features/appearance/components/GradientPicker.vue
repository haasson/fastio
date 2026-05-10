<template>
  <div class="gradient-picker-root">
    <button
      v-for="g in resolvedGradients"
      :key="g.id"
      class="item"
      :class="{ active: modelValue === g.id }"
      :title="g.label"
      @click="emit('update:modelValue', g.id)"
    >
      <div class="preview" :style="{ background: g.resolvedCss }" />
      <span class="name">{{ g.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { heroGradients, resolveGradientCss } from '@fastio/shared'
import type { ThemePalette } from '@fastio/shared'

const props = defineProps<{
  modelValue: string
  palette: ThemePalette | null
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const resolvedGradients = computed(() => heroGradients.map((g) => ({
  ...g,
  resolvedCss: props.palette ? resolveGradientCss(g.css, props.palette) : g.css,
})),
)
</script>

<style scoped lang="scss">
.gradient-picker-root {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-8);
}

.item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  background: none;
  border: 2px solid transparent;
  border-radius: var(--radius-8);
  padding: var(--space-4);
  cursor: pointer;
  transition: border-color 0.15s;

  &:hover {
    border-color: var(--color-border);
  }

  &.active {
    border-color: var(--color-primary);
  }
}

.preview {
  width: 100%;
  height: 52px;
  border-radius: var(--radius-8);
}

.name {
  font-size: var(--font-size-xs);
  color: var(--color-text-hint);
}
</style>
