<template>
  <div class="page-layout-root">
    <div class="page-head">
      <NuxtLink :to="backTo" class="back-link">
        <ChevronLeft :size="18" />
        {{ backLabel }}
      </NuxtLink>
      <FsHeading as="h3"><slot name="heading" /></FsHeading>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components'
import { ChevronLeft } from 'lucide-vue-next'
import { FsHeading } from '@fastio/public-ui'

type Props = {
  backTo: string
  backLabel: string
}

defineProps<Props>()
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.page-layout-root {
  padding-block: 24px 80px;

  @include md {
    padding-block: 32px 80px;
  }
}

.page-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  @include text-caption;
  color: var(--color-text-muted);
  text-decoration: none;
  transition: color 0.15s;

  &:hover {
    color: var(--primary);
  }
}
</style>
