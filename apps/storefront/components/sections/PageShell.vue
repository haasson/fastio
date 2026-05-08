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
      <CategoryBar
        :overflow="layout.sections.categoryBar.overflow"
        :sticky-offset="stickyTotalHeight"
        :navigate-on-click="categoryBarNavigate"
      />
    </div>

    <div class="page-content">
      <slot :sticky-total-height="stickyTotalHeight" :layout="layout" />
    </div>

    <SiteFooter
      :class="{
        'has-fab': (showCartFab && hasCartItems) || showBookingFab,
        'has-fab-tall': showCartFab && hasCartItems && cartFabHasAddress,
      }"
    />
    <SfCartFab v-if="showCartFab" @click="navigateTo('/cart')" />
    <SfBookingFab v-else-if="showBookingFab" @click="navigateTo('/booking')" />
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useNuxtData, navigateTo, useRoute } from 'nuxt/app'
import { useElementSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import type { BranchPublic, Tenant } from '@fastio/shared'
import { defaultSiteLayout, deepMerge, formatBranchAddressShort } from '@fastio/shared'
import SiteHeader from '~/components/sections/SiteHeader.vue'
import CategoryBar from '~/components/sections/CategoryBar.vue'
import SiteFooter from '~/components/sections/SiteFooter.vue'
import { useCartStore } from '~/stores/cart'
import { useSelectedBranchStore } from '~/stores/selectedBranch'
import SfCartFab from '~/components/sf/domain/SfCartFab.vue'
import SfBookingFab from '~/components/sf/domain/SfBookingFab.vue'
import useLegalCompliance from '~/composables/useLegalCompliance'

withDefaults(defineProps<{
  showCategoryBar?: boolean
  categoryBarNavigate?: boolean
}>(), {
  showCategoryBar: false,
  categoryBarNavigate: false,
})

const { data: tenant } = useNuxtData<Tenant>('tenant')
const route = useRoute()

type SiteLayout = ReturnType<typeof defaultSiteLayout>

const layout = computed(() =>
  deepMerge(defaultSiteLayout(), (tenant.value?.siteLayout ?? {}) as Partial<SiteLayout>)
)

const { count } = storeToRefs(useCartStore())
const hasCartItems = computed(() => count.value > 0)

const branchStore = useSelectedBranchStore()
const { data: branchesData } = useNuxtData<BranchPublic[]>('branches')

// FAB корзины показывает адрес снизу второй строкой только на мобилке (на десктопе
// прячем — адрес дублируется в pill шапки). Когда есть caption — увеличиваем
// нижний отступ контента, иначе FAB заслоняет хвост страницы.
const cartFabHasAddress = computed(() => {
  if (tenant.value?.branchSelectionMode !== 'per_branch') return false
  const branch = branchesData.value?.find((b) => b.id === branchStore.id)
  return !!branch && !!formatBranchAddressShort(branch)
})

const { legalInfoComplete } = useLegalCompliance()

const isServices = computed(() => tenant.value?.businessType === 'services')
const servicesModuleEnabled = computed(() => !!tenant.value?.modules?.services)
const orderingEnabled = computed(() => !!tenant.value?.orderingEnabled)
const effectiveOrderingEnabled = computed(() => orderingEnabled.value && legalInfoComplete.value)
const showCartFab = computed(() => {
  if (['/cart', '/checkout', '/appointments/checkout'].includes(route.path)) return false
  if (isServices.value) return servicesModuleEnabled.value && legalInfoComplete.value
  return effectiveOrderingEnabled.value
})
const showBookingFab = computed(() => !isServices.value && !orderingEnabled.value && !!tenant.value?.modules?.reservations && legalInfoComplete.value && route.path !== '/booking')

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
  min-height: 100dvh;
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
  padding-bottom: max(100px, calc(80px + env(safe-area-inset-bottom)));
}

// FAB корзины с адресом второй строкой → нужен запас побольше.
// Только на мобилке: на десктопе caption скрыт.
.has-fab-tall {
  @media (max-width: 767px) {
    padding-bottom: max(132px, calc(112px + env(safe-area-inset-bottom)));
  }
}
</style>
