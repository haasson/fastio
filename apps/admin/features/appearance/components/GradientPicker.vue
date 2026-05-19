<template>
  <div class="gradient-picker-root">
    <UiPickerItem
      v-for="g in resolvedGradients"
      :key="g.id"
      :selected="modelValue === g.id"
      :title="g.label"
      class="item"
      @click="emit('update:modelValue', g.id)"
    >
      <div class="preview" :style="{ background: g.resolvedCss }" />
      <span class="name">{{ g.label }}</span>
    </UiPickerItem>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { heroGradients, resolveGradientCss } from '@fastio/shared'
import type { ThemePalette } from '@fastio/shared'
import { UiPickerItem } from '@fastio/ui'

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

// UiPickerItem уже делает border + selected ring. Здесь — только layout.
.item {
  flex-direction: column;
  gap: var(--space-4);
  border-radius: var(--radius-8);
  padding: var(--space-4);
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
