<template>
  <FsSection class="gallery-root">
    <FsHeading as="h2">Галерея</FsHeading>
    <div class="gallery-content">
      <SfEmptyState title="Галерея пуста" description="Фотографии появятся здесь">
        <Image :size="48" />
      </SfEmptyState>
    </div>
  </FsSection>
</template>

<script setup lang="ts">
import { Image } from 'lucide-vue-next'
import { FsSection, FsHeading } from '@fastio/public-ui'
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
