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

.title {
  font-weight: 800;
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
      line-height: 1.2;
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
    font-weight: 700;
  }

  &:where(.title--h3.title--responsive) {
    @include mq-l {
      font-size: 20px;
      line-height: 1.4;
    }
  }

  &:where(.title--h4) {
    font-size: 16px;
    line-height: 1.37;
    font-weight: 700;
  }

  &:where(.title--h4.title--responsive) {
    @include mq-l {
      font-size: 20px;
      line-height: 1.4;
    }
  }

  &:where(.title--h5) {
    font-size: 16px;
    line-height: 1.37;
    font-weight: 700;
  }

  &:where(.title--h5.title--responsive) {
    @include mq-l {
      font-size: 18px;
      line-height: 1.33;
    }
  }
}
</style>
