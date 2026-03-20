<template>
  <FsSection class="reviews-root">
    <FsHeading as="h2">Отзывы</FsHeading>
    <div class="reviews-content">
      <SfEmptyState title="Отзывов пока нет" description="Будьте первым, кто оставит отзыв">
        <MessageCircle :size="48" />
      </SfEmptyState>
    </div>
  </FsSection>
</template>

<script setup lang="ts">
import { MessageCircle } from 'lucide-vue-next'
import { FsSection, FsHeading } from '@fastio/public-ui'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.reviews-root {}

.reviews-content {
  margin-top: 32px;
}
</style>
