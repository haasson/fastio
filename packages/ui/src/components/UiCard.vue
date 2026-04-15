<template>
  <component
    :is="clickable ? 'button' : 'div'"
    class="card"
    :class="[`size-${size}`, { clickable, accent }]"
    v-bind="clickable ? { type: 'button' } : {}"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
export type UiCardProps = {
  size?: 'small' | 'medium' | 'large'
  clickable?: boolean
  accent?: boolean
}

withDefaults(defineProps<UiCardProps>(), {
  size: 'medium',
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins' as *;

.card {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-12);
  background-color: var(--color-bg-card);
  border: none;
  text-align: left;
  font: inherit;
  color: inherit;
  width: 100%;

  &:where(.clickable) {
    cursor: pointer;
    transition: box-shadow 0.2s;

    &:hover {
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    }
  }

  &:where(.size-small) { padding: var(--space-12); }
  &:where(.size-medium) { padding: var(--space-16); }
  &:where(.size-large) { padding: var(--space-20); }

  @include mq-l {
    border-radius: var(--radius-16);

    &:where(.size-small) { padding: var(--space-12); }
    &:where(.size-medium) { padding: var(--space-20); }
    &:where(.size-large) { padding: var(--space-24); }
  }
}
</style>
