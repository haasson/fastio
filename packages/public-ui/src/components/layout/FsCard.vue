<template>
  <component
    :is="as"
    class="card-root"
    :class="{ 'card-horizontal': horizontal }"
  >
    <div v-if="image || $slots.image" class="card-image" :style="imageStyle">
      <slot name="image">
        <img :src="image" :alt="imageAlt" loading="lazy" />
      </slot>
    </div>
    <div class="card-body">
      <slot />
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Props = {
  as?: string
  image?: string
  imageAlt?: string
  imageAspect?: string
  imageSize?: string
  horizontal?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  as: 'article',
  imageAspect: '4 / 3',
  horizontal: false,
})

const imageStyle = computed(() => {
  if (props.horizontal && props.imageSize) {
    return { width: props.imageSize, height: props.imageSize, flexShrink: '0' }
  }
  return { aspectRatio: props.imageAspect }
})
</script>

<style scoped lang="scss">
.card-root {
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: var(--radius-card);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition: box-shadow 0.2s;
  text-align: left;
  border: none;
  cursor: default;

  &:hover {
    box-shadow: var(--shadow-card-md, var(--shadow-card));
  }

  &[role='button'],
  &:is(button, a) {
    cursor: pointer;
  }
}

.card-horizontal {
  flex-direction: row;
}

.card-image {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  width: 100%;

  .card-horizontal & {
    width: auto;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.3s;
  }

  .card-root:hover & img {
    transform: scale(1.03);
  }
}

.card-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
</style>
