<template>
  <div class="page-layout-root">
    <div class="page-head">
      <nav class="breadcrumbs">
        <template v-for="(crumb, i) in breadcrumbs" :key="i">
          <NuxtLink :to="crumb.to" class="crumb">{{ crumb.label }}</NuxtLink>
          <span class="dot" />
        </template>
        <span class="crumb-current">{{ current }}</span>
      </nav>
      <FsHeading as="h3" class="heading">{{ current }}</FsHeading>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components'
import { FsHeading } from '@fastio/public-ui'

type Breadcrumb = { label: string; to: string }

type Props = {
  breadcrumbs: Breadcrumb[]
  current: string
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

.breadcrumbs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.crumb {
  @include text-caption;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color 0.15s;

  &:hover {
    color: var(--primary);
  }
}

.dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--color-text-muted);
  opacity: 0.5;
  flex-shrink: 0;
}

.crumb-current {
  @include text-caption;
  color: var(--color-text-muted);
}

.heading {
  margin: 0;
}
</style>
