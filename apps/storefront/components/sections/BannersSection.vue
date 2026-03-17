<template>
  <SfSection class="banners-root">
    <div class="banner-placeholder">
      <SfSkeleton variant="rect" height="200px" :rounded="true" />
    </div>
  </SfSection>
</template>

<script setup lang="ts">
import SfSection from '~/components/sf/layout/SfSection.vue'
import SfSkeleton from '~/components/sf/base/SfSkeleton.vue'
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.banners-root {
  padding-block: 40px;

  @include lg {
    padding-block: 64px;
  }
}

.banner-placeholder {
  width: 100%;
}
</style>
