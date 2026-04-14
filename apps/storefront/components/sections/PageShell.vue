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

    <SiteFooter :class="{ 'has-fab': (showCartFab && hasCartItems) || showBookingFab }" />
    <SfCartFab v-if="showCartFab" @click="navigateTo('/cart')" />
    <SfBookingFab v-else-if="showBookingFab" @click="navigateTo('/booking')" />
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useNuxtData, navigateTo, useRoute } from 'nuxt/app'
import { useElementSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import type { Tenant } from '@fastio/shared'
import { defaultSiteLayout, deepMerge } from '@fastio/shared'
import SiteHeader from '~/components/sections/SiteHeader.vue'
import CategoryBar from '~/components/sections/CategoryBar.vue'
import SiteFooter from '~/components/sections/SiteFooter.vue'
import { useCartStore } from '~/stores/cart'
import SfCartFab from '~/components/sf/domain/SfCartFab.vue'
import SfBookingFab from '~/components/sf/domain/SfBookingFab.vue'

withDefaults(defineProps<{
  showCategoryBar?: boolean
}>(), {
  showCategoryBar: false,
})

const { data: tenant } = useNuxtData<Tenant>('tenant')
const route = useRoute()

type SiteLayout = ReturnType<typeof defaultSiteLayout>

const layout = computed(() =>
  deepMerge(defaultSiteLayout(), (tenant.value?.siteLayout ?? {}) as Partial<SiteLayout>)
)

const { count } = storeToRefs(useCartStore())
const hasCartItems = computed(() => count.value > 0)

const isServices = computed(() => tenant.value?.businessType === 'services')
const orderingEnabled = computed(() => !!tenant.value?.orderingEnabled)
const showCartFab = computed(() => !isServices.value && orderingEnabled.value && !['/cart', '/checkout'].includes(route.path))
const showBookingFab = computed(() => !isServices.value && !orderingEnabled.value && !!tenant.value?.modules?.reservations && route.path !== '/booking')

const headerRef = useTemplateRef('headerRef')
const { height: headerHeight } = useElementSize(headerRef)
const categoryBarRef = useTemplateRef('categoryBarRef')
const { height: categoryBarHeight } = useElementSize(categoryBarRef)
const stickyTotalHeight = computed(() => headerHeight.value + categoryBarHeight.value)

</script>

<style scoped lang="scss">
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

.has-fab {
  padding-bottom: 100px;
}
</style>
