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
@use '../styles/mixins' as *;

.card {
  display: flex;
  flex-direction: column;
  border-radius: 14px;
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

  &:where(.size-small) { padding: 12px; }
  &:where(.size-medium) { padding: 16px; }
  &:where(.size-large) { padding: 20px; }

  @include mq-l {
    border-radius: 16px;

    &:where(.size-small) { padding: 14px; }
    &:where(.size-medium) { padding: 20px; }
    &:where(.size-large) { padding: 24px; }
  }
}
</style>
