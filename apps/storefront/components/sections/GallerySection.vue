<template>
  <div v-bind="$attrs">
    <template v-for="gallery in visibleGalleries" :key="gallery.id">
      <FsSection class="gallery-section">
        <div v-if="gallery.title || gallery.description" class="gallery-header">
          <FsHeading v-if="gallery.title" as="h2">{{ gallery.title }}</FsHeading>
          <p v-if="gallery.description" class="gallery-desc">{{ gallery.description }}</p>
        </div>

        <GallerySlider :gallery="gallery" />
      </FsSection>
    </template>
  </div>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
import { computed } from 'vue'
import { FsSection, FsHeading } from '@fastio/public-ui'
import type { Gallery } from '@fastio/shared'
import GallerySlider from './GallerySlider.vue'

const props = defineProps<{
  galleries: Gallery[]
  galleryIds: string[]
}>()

const visibleGalleries = computed(() =>
  props.galleryIds
    .map((id) => props.galleries.find((g) => g.id === id))
    .filter((g): g is Gallery => !!g && g.photos.length > 0),
)
</script>

<style scoped lang="scss">
.gallery-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.gallery-desc {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}
</style>
