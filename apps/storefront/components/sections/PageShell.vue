<template>
  <div class="page-shell-root">
    <div ref="headerRef" class="sticky-header">
      <SiteHeader :tenant="tenant" :header="layout.header" />
    </div>

    <div
      v-if="showCategoryBar && layout.sectionsOrder.includes('categoryBar')"
      ref="categoryBarRef"
      class="sticky-category-bar"
    >
      <CategoryBar :overflow="layout.sections.categoryBar.overflow" :sticky-offset="stickyTotalHeight" />
    </div>

    <div class="page-content">
      <slot :sticky-total-height="stickyTotalHeight" :layout="layout" />
    </div>

    <SiteFooter />
    <slot name="fab" />
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useNuxtData } from 'nuxt/app'
import { useElementSize } from '@vueuse/core'
import type { Tenant } from '@fastio/shared'
import { defaultSiteLayout, deepMerge } from '@fastio/shared'
import SiteHeader from '~/components/sections/SiteHeader.vue'
import CategoryBar from '~/components/sections/CategoryBar.vue'
import SiteFooter from '~/components/sections/SiteFooter.vue'

withDefaults(defineProps<{
  showCategoryBar?: boolean
}>(), {
  showCategoryBar: false,
})

const { data: tenant } = useNuxtData<Tenant>('tenant')

type SiteLayout = ReturnType<typeof defaultSiteLayout>

const layout = computed(() =>
  deepMerge(defaultSiteLayout(), (tenant.value?.siteLayout ?? {}) as Partial<SiteLayout>)
)

const headerRef = useTemplateRef('headerRef')
const { height: headerHeight } = useElementSize(headerRef)
const categoryBarRef = useTemplateRef('categoryBarRef')
const { height: categoryBarHeight } = useElementSize(categoryBarRef)
const stickyTotalHeight = computed(() => headerHeight.value + categoryBarHeight.value)

</script>

<style scoped>
.page-shell-root {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.sticky-header {
  position: sticky;
  top: 0;
  z-index: 200;
}

.sticky-category-bar {
  position: sticky;
  top: var(--header-height);
  z-index: 99;
}

.page-content {
  flex: 1;
}
</style>
