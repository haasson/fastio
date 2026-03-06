<template>
  <div
    class="card"
    :class="[
      `size-${size}`,
      { 'with-header': $slots.header || header, responsive, accent }
    ]"
  >
    <div v-if="$slots.header || header" class="header">
      <slot name="header">{{ header }}</slot>
    </div>
    <div class="content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Size } from '../types/responsive'

export type UiCardProps = {
  size?: Size
  responsive?: boolean
  accent?: boolean
  header?: string
}

withDefaults(defineProps<UiCardProps>(), {
  size: 'medium',
  responsive: false,
  accent: false,
})
</script>

<style scoped lang="scss">
@use '../styles/mixins' as *;

.card {
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  background-color: var(--color-white);
  box-shadow: inset 0 0 0 3px transparent;

  & > .content {
    flex: 1 1 auto;
    min-height: 0;
  }

  &:where(.responsive) {
    @include mq-l {
      border-radius: 32px;
    }
  }

  &:where(.size-tiny) {
    border-radius: 20px;

    &.responsive {
      @include mq-l {
        border-radius: 20px;
      }
    }
  }

  &:where(.accent) {
    box-shadow: inset 0 0 0 3px var(--color-primary);
  }

  &:where(.with-header) {
    position: relative;
    box-shadow: none;
    background-color: var(--color-border);

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      box-shadow: inset 0 0 0 3px var(--color-border);
      pointer-events: none;
    }

    & > .header {
      @include secondary-font(12);
      padding: 9px;
      font-weight: 700;
      text-align: center;

      @include mq-l {
        @include secondary-font(14);
        padding: 15px;
      }
    }

    & > .content {
      background-color: var(--color-white);
    }
  }

  &:where(.with-header.accent) {
    background-color: var(--color-primary);

    &::after {
      box-shadow: inset 0 0 0 3px var(--color-primary);
    }

    & > .header {
      color: var(--color-white);
    }
  }

  &:where(.size-tiny) > .content { padding: 16px 12px; }
  &:where(.size-tiny.responsive) > .content { @include mq-l { padding: 20px 16px; } }

  &:where(.size-small) > .content { padding: 20px 16px; }
  &:where(.size-small.responsive) > .content { @include mq-l { padding: 32px 24px; } }

  &:where(.size-medium) > .content { padding: 20px 16px; }
  &:where(.size-medium.responsive) > .content { @include mq-l { padding: 40px 32px; } }

  &:where(.size-large) > .content { padding: 20px 16px; }
  &:where(.size-large.responsive) > .content { @include mq-l { padding: 40px 32px; } }
}
</style>
