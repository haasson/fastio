<template>
  <div class="reviews-root">
    <AppStorefrontAlert feature-key="reviews" />
    <UiEmpty icon="messageCircle" text="Раздел отзывов появится здесь совсем скоро." />
  </div>
</template>

<script setup lang="ts">
import { UiEmpty } from '@fastio/ui'
import AppStorefrontAlert from '~/components/ui/AppStorefrontAlert.vue'
</script>

<style scoped lang="scss">
.reviews-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}
</style>
