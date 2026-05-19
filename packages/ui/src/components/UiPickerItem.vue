<template>
  <button
    type="button"
    class="ui-picker-item"
    :class="{
      'ui-picker-item--selected': selected,
      'ui-picker-item--disabled': disabled,
    }"
    :disabled="disabled"
    :aria-pressed="selected"
    :title="title"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
type Props = {
  selected?: boolean
  disabled?: boolean
  title?: string
}

withDefaults(defineProps<Props>(), {
  selected: false,
  disabled: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<style scoped lang="scss">
// Thin wrapper: даёт единый selection/hover/focus ring + button-reset + a11y.
// Размер, border-radius и внутреннее содержимое задаёт родитель (color circle,
// icon tile, gradient preview, preset card — у всех визуально разные shape'ы).
// Цвета ring'а override'ятся через CSS custom properties — например для
// light-variant поверх тёмного фона (см. ContentPositionPicker).
.ui-picker-item {
  --picker-selected-border: var(--color-primary);
  --picker-hover-border: var(--color-text-secondary);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 2px solid transparent;
  background: transparent;
  cursor: pointer;
  // Шире чем border-color — родители часто меняют bg/color/box-shadow/transform
  // при selected/hover и ожидают плавный переход (унаследовано от raw <button> кода).
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast),
    opacity var(--transition-fast);

  &--selected {
    border-color: var(--picker-selected-border);
  }

  &--disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:hover:not(.ui-picker-item--disabled):not(.ui-picker-item--selected) {
    border-color: var(--picker-hover-border);
  }

  &:focus-visible {
    outline: 2px solid var(--picker-selected-border);
    outline-offset: 2px;
  }
}
</style>
