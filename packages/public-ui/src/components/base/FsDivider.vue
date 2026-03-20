<template>
  <hr
    class="divider-root"
    :class="[`divider-${orientation}`, `spacing-${spacing}`]"
    role="separator"
    :aria-orientation="orientation"
  />
</template>
<script setup lang="ts">
type Props = {
  orientation?: 'horizontal' | 'vertical'
  spacing?: 'none' | 'sm' | 'md' | 'lg'
}

withDefaults(defineProps<Props>(), {
  orientation: 'horizontal',
  spacing: 'md',
})
</script>
<style scoped lang="scss">
.divider-root {
  border: none;
  background: var(--color-border);
  flex-shrink: 0;
}

// Horizontal
.divider-horizontal {
  width: 100%;
  height: 1px;

  &.spacing-none { margin-block: 0; }
  &.spacing-sm   { margin-block: 8px; }
  &.spacing-md   { margin-block: 16px; }
  &.spacing-lg   { margin-block: 24px; }
}

// Vertical
.divider-vertical {
  width: 1px;
  height: 100%;
  align-self: stretch;

  &.spacing-none { margin-inline: 0; }
  &.spacing-sm   { margin-inline: 8px; }
  &.spacing-md   { margin-inline: 16px; }
  &.spacing-lg   { margin-inline: 24px; }
}
</style>
