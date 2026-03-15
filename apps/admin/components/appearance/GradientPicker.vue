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
  gap: 8px;
}

.item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  background: none;
  border: 2px solid transparent;
  border-radius: 10px;
  padding: 3px;
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
  border-radius: 6px;
}

.name {
  font-size: 11px;
  color: var(--color-text-hint);
}
</style>
