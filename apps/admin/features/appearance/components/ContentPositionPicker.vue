<template>
  <div class="picker-root" :class="{ light }">
    <button
      v-for="pos in 9"
      :key="pos"
      type="button"
      class="cell"
      :class="{ selected: modelValue === pos }"
      :aria-label="`Позиция ${pos}`"
      @click="emit('update:modelValue', pos)"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{ modelValue: number; light?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
</script>

<style scoped lang="scss">
.picker-root {
  display: grid;
  grid-template-columns: repeat(3, var(--cell-size, 32px));
  grid-template-rows: repeat(3, var(--cell-size, 32px));
  gap: var(--space-4);
}

/* Light variant — для вставки поверх тёмного/градиентного фона */
.light .cell {
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: var(--radius-4);
  background: rgba(255, 255, 255, 0.15);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    border-color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.25);
  }

  &.selected {
    border-color: var(--color-white);
    background: rgba(255, 255, 255, 0.6);
  }
}

/* Default variant — для настроек на светлом фоне */
.cell {
  border: 2px solid var(--color-border);
  border-radius: var(--radius-4);
  background: var(--color-bg-card);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    border-color: var(--color-text-secondary);
  }

  &.selected {
    border-color: var(--color-primary);
    background: var(--color-primary);
    opacity: 0.8;
  }
}
</style>
