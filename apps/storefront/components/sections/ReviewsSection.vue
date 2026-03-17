<template>
  <SfSection class="reviews-root">
    <SfHeading as="h2">Отзывы</SfHeading>
    <div class="reviews-content">
      <SfEmptyState title="Отзывов пока нет" description="Будьте первым, кто оставит отзыв">
        <MessageCircle :size="48" />
      </SfEmptyState>
    </div>
  </SfSection>
</template>

<script setup lang="ts">
import { MessageCircle } from 'lucide-vue-next'
import SfSection from '~/components/sf/layout/SfSection.vue'
import SfHeading from '~/components/sf/typography/SfHeading.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.reviews-root {}

.reviews-content {
  margin-top: 32px;
}
</style>
