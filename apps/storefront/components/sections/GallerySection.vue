<template>
  <SfSection class="gallery-root">
    <SfHeading as="h2">Галерея</SfHeading>
    <div class="gallery-content">
      <SfEmptyState title="Галерея пуста" description="Фотографии появятся здесь">
        <Image :size="48" />
      </SfEmptyState>
    </div>
  </SfSection>
</template>

<script setup lang="ts">
import { Image } from 'lucide-vue-next'
import SfSection from '~/components/sf/layout/SfSection.vue'
import SfHeading from '~/components/sf/typography/SfHeading.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.gallery-root {
  background: var(--color-surface);
}

.gallery-content {
  margin-top: 32px;
}
</style>
