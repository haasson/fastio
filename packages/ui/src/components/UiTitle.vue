<template>
  <component :is="tag ?? size" class="title" :class="titleClasses">
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Props = {
  size: 'h1' | 'h2' | 'h3' | 'h4' | 'h5'
  tag?: string
  responsive?: boolean
  darkSide?: boolean
}

const props = defineProps<Props>()

const titleClasses = computed(() => ({
  [`title--${props.size}`]: true,
  'title--responsive': props.responsive,
  'title--dark-side': props.darkSide,
}))
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins' as *;

/* stylelint-disable scale-unlimited/declaration-strict-value */
.title {
  font-weight: var(--font-weight-bold);
  color: var(--color-title);

  &:where(.title--dark-side) {
    color: var(--grey-50);
  }

  &:where(.title--h1) {
    @include secondary-font(32);
    line-height: 1.12;
  }

  &:where(.title--h1.title--responsive) {
    @include mq-l {
      @include secondary-font(40);
      line-height: var(--line-height-tight);
    }
  }

  &:where(.title--h2) {
    @include secondary-font(24);
    line-height: 1.16;
  }

  &:where(.title--h2.title--responsive) {
    @include mq-l {
      @include secondary-font(32);
      line-height: 1.12;
    }
  }

  &:where(.title--h3) {
    font-size: 18px;
    line-height: 1.33;
    font-weight: var(--font-weight-bold);
  }

  &:where(.title--h3.title--responsive) {
    @include mq-l {
      font-size: var(--font-size-xl);
      line-height: var(--line-height-base);
    }
  }

  &:where(.title--h4) {
    font-size: var(--font-size-lg);
    line-height: 1.37;
    font-weight: var(--font-weight-bold);
  }

  &:where(.title--h4.title--responsive) {
    @include mq-l {
      font-size: var(--font-size-xl);
      line-height: var(--line-height-base);
    }
  }

  &:where(.title--h5) {
    font-size: var(--font-size-lg);
    line-height: 1.37;
    font-weight: var(--font-weight-bold);
  }

  &:where(.title--h5.title--responsive) {
    @include mq-l {
      font-size: 18px;
      line-height: 1.33;
    }
  }
}
/* stylelint-enable */
</style>
