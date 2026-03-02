<template>
  <component :is="tagName" class="text" :class="textClasses">
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Props = {
  size?: 'tiny' | 'small' | 'medium'
  span?: boolean
  darkSide?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  span: false,
})

const tagName = computed(() => props.span ? 'span' : 'p')

const textClasses = computed(() => ({
  [`text--${props.size}`]: true,
  'text--dark-side': props.darkSide,
}))
</script>

<style scoped lang="scss">
@use '../styles/mixins/media-queries' as *;

.text {
  font-family: var(--main-font);
  color: var(--color-text);

  &:where(.text--dark-side) {
    color: var(--grey-50);
  }

  &:where(.text--tiny) {
    font-size: 12px;
    line-height: 1.33;

    @include mq-l {
      font-size: 14px;
      line-height: 1.42;
    }
  }

  &:where(.text--small) {
    font-size: 14px;
    line-height: 1.42;

    @include mq-l {
      font-size: 16px;
      line-height: 1.5;
    }
  }

  &:where(.text--medium) {
    font-size: 16px;
    line-height: 1.5;

    @include mq-l {
      font-size: 18px;
      line-height: 1.33;
    }
  }
}
</style>
