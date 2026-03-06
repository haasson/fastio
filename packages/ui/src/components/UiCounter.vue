<template>
  <span class="counter" :class="[`counter--${type}`, `counter--${size}`, { 'counter--filled': filled }]">
    {{ value }}
  </span>
</template>

<script setup lang="ts">
type CounterType = 'default' | 'primary' | 'success' | 'warning' | 'error'
type CounterSize = 'tiny' | 'small' | 'medium'

defineProps<{
  value: number
  type?: CounterType
  size?: CounterSize
  filled?: boolean
}>()
</script>

<style scoped lang="scss">
@use 'sass:map';

$counter-types: (
  'default': ('bg': var(--grey-100), 'color': var(--grey-500)),
  'primary': ('bg': var(--blue-50),  'color': var(--color-primary)),
  'success': ('bg': var(--green-50), 'color': var(--color-success)),
  'warning': ('bg': var(--yellow-50),'color': var(--yellow-600)),
  'error':   ('bg': var(--red-50),   'color': var(--red-500)),
);

$counter-sizes: (
  'tiny':   ('font-size': 11px, 'padding': 1px 5px, 'border-radius': 5px),
  'small':  ('font-size': 12px, 'padding': 2px 6px, 'border-radius': 6px),
  'medium': ('font-size': 13px, 'padding': 2px 8px, 'border-radius': 7px),
);

.counter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1;

  @each $size, $props in $counter-sizes {
    &.counter--#{$size} {
      font-size: map.get($props, 'font-size');
      padding: map.get($props, 'padding');
      border-radius: map.get($props, 'border-radius');
    }
  }

  @each $type, $props in $counter-types {
    &.counter--#{$type} {
      background: map.get($props, 'bg');
      color: map.get($props, 'color');
    }

    &.counter--#{$type}.counter--filled {
      background: rgba(255, 255, 255, 0.22);
      color: rgba(255, 255, 255, 0.85);
    }
  }
}
</style>
