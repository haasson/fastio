<template>
  <div class="slider-root">
    <div ref="viewportRef" class="viewport">
      <div class="slides">
        <div v-for="photo in gallery.photos" :key="photo.id" class="slide">
          <img :src="photo.url" alt="" class="slide-img" loading="lazy" >
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import useEmblaCarousel from 'embla-carousel-vue'
import AutoplayPlugin from 'embla-carousel-autoplay'
import type { Gallery } from '@fastio/shared'

const props = defineProps<{
  gallery: Gallery
}>()

const plugins = computed(() => {
  if (!props.gallery.autoplay) return []

  return [AutoplayPlugin({ delay: props.gallery.autoplayInterval * 1000, stopOnInteraction: false, stopOnMouseEnter: true })]
})

const [viewportRef, emblaApi] = useEmblaCarousel(
  { loop: false, align: 'center' },
  plugins,
)

onBeforeUnmount(() => emblaApi.value?.destroy())
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.slider-root {
  width: 100%;
}

.viewport {
  overflow: hidden;
}

.slides {
  display: flex;
  gap: 8px;
}

.slide {
  flex: 0 0 80%;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-card);
  overflow: hidden;

  @include md {
    flex: 0 0 auto;
    aspect-ratio: unset;
    height: 240px;
  }
}

.slide-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;

  @include md {
    width: auto;
    object-fit: unset;
  }
}
</style>
