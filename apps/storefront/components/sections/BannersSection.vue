<template>
  <FsSection class="banners-root">
    <div class="banner-placeholder">
      <FsSkeleton variant="rect" height="200px" :rounded="true" />
    </div>
  </FsSection>
</template>

<script setup lang="ts">
import { FsSection, FsSkeleton } from '@fastio/public-ui'
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.banners-root {}

.banner-placeholder {
  width: 100%;
}
</style>
