<template>
  <FsSection v-if="visibleBanners.length" class="banners-root">
    <div ref="viewportRef" class="viewport">
      <div class="slides">
        <div
          v-for="banner in visibleBanners"
          :key="banner.url"
          class="slide"
          :class="{ 'slide--single': settings.displayMode === 'single' }"
        >
          <component
            :is="banner.link ? 'a' : 'div'"
            v-bind="banner.link ? { href: banner.link, target: '_blank', rel: 'noopener noreferrer' } : {}"
            class="slide-inner"
          >
            <img :src="banner.url" alt="" class="slide-img" loading="lazy" />
          </component>
        </div>
      </div>
    </div>

    <template v-if="visibleBanners.length > 1">
      <div class="dots">
        <button
          v-for="(_, i) in scrollSnaps"
          :key="i"
          type="button"
          class="dot"
          :class="{ 'dot--active': i === selectedIndex }"
          :aria-label="`Баннер ${i + 1}`"
          @click="scrollTo(i)"
        />
      </div>

    </template>
  </FsSection>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import useEmblaCarousel from 'embla-carousel-vue'
import AutoplayPlugin from 'embla-carousel-autoplay'
import { FsSection } from '@fastio/public-ui'
import type { BannerItem, SiteLayout } from '@fastio/shared'

const props = defineProps<{
  banners: BannerItem[]
  settings: SiteLayout['sections']['banners']
}>()

const visibleBanners = computed(() => props.banners.filter(b => b.enabled))

const plugins = computed(() => {
  if (!props.settings.autoplay) return []
  return [AutoplayPlugin({ delay: props.settings.autoplayInterval * 1000, stopOnInteraction: false, stopOnMouseEnter: true })]
})

const [viewportRef, emblaApi] = useEmblaCarousel(
  {
    loop: true,
    align: props.settings.displayMode === 'single' ? 'center' : 'start',
    containScroll: props.settings.displayMode === 'auto' ? 'trimSnaps' : false,
    slidesToScroll: props.settings.displayMode === 'single' ? 1 : 'auto',
  },
  plugins,
)

const selectedIndex = ref(0)
const scrollSnaps = ref<number[]>([])

const scrollTo = (i: number) => emblaApi.value?.scrollTo(i)

const onSelect = () => {
  if (!emblaApi.value) return
  selectedIndex.value = emblaApi.value.selectedScrollSnap()
}

const onInit = () => {
  if (!emblaApi.value) return
  scrollSnaps.value = emblaApi.value.scrollSnapList()
  onSelect()
}

onMounted(() => {
  if (!emblaApi.value) return
  onInit()
  emblaApi.value.on('select', onSelect)
  emblaApi.value.on('reInit', onInit)
})

onBeforeUnmount(() => {
  emblaApi.value?.destroy()
})
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.banners-root {
  position: relative;
}

.viewport {
  overflow: hidden;
  border-radius: var(--radius-card);
  aspect-ratio: 3 / 1;
}

.slides {
  display: flex;
  height: 100%;
}

.slide {
  position: relative;
  min-width: 0;
  flex: 0 0 auto;

  &--single {
    flex: 0 0 100%;
  }
}

.slide-inner {
  display: block;
  width: 100%;
  height: 100%;
}

.slide-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

// --- auto mode: banners keep proportions, fit by height ---
.slide:not(.slide--single) {
  height: 100%;

  .slide-img {
    width: auto;
    height: 100%;
    object-fit: contain;
  }
}

// --- dots ---
.dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  padding: 0;
  cursor: pointer;
  background: transparent;
  border: 2px solid var(--primary);
  transition: background 0.2s;

  &--active {
    background: var(--primary);
  }
}

</style>
