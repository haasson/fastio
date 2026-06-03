<template>
  <div class="table-layout-root">
    <header ref="headerRef" class="table-header">
      <img
        v-if="logo"
        :src="logo"
        :alt="tenantName"
        class="logo"
      >
      <span v-else class="tenant-name">{{ tenantName }}</span>
      <ClientOnly>
        <!-- Кнопка вызова официанта — только если тенант включил toggle (table_settings). -->
        <div v-if="tableStore.tableId && tableStore.waiterCallEnabled" class="table-header-actions">
          <CallWaiterButton :table-id="tableStore.tableId" />
        </div>
      </ClientOnly>
    </header>

    <ClientOnly>
      <div ref="categoryBarRef" class="sticky-category-bar">
        <CategoryBar overflow="scroll" :sticky-offset="stickyTotalHeight" />
      </div>
    </ClientOnly>

    <div class="table-content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useNuxtData } from 'nuxt/app'
import { useElementSize } from '@vueuse/core'
import type { Tenant } from '@fastio/shared'
import { useTableStore, CallWaiterButton } from '~/features/table-mode'
import CategoryBar from '~/shared/ui/sections/CategoryBar.vue'

const { data: tenant } = useNuxtData<Tenant>('tenant')
const tableStore = useTableStore()
const logo = computed(() => tenant.value?.siteContent?.logo ?? null)
const tenantName = computed(() => tenant.value?.name ?? '')

const headerRef = useTemplateRef('headerRef')
const { height: headerHeight } = useElementSize(headerRef)
const categoryBarRef = useTemplateRef('categoryBarRef')
const { height: categoryBarHeight } = useElementSize(categoryBarRef)
const stickyTotalHeight = computed(() => headerHeight.value + categoryBarHeight.value)
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.table-layout-root {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.table-header {
  display: flex;
  align-items: center;
  gap: 12px;
  height: var(--header-height);
  padding: 0 16px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
  position: sticky;
  top: 0;
  z-index: var(--z-header);

  @include md {
    padding: 0 24px;
  }
}

.logo {
  height: 32px;
  width: auto;
  flex-shrink: 0;
  object-fit: contain;
}

.tenant-name {
  @include text-body(600);

  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.table-header-actions {
  margin-left: auto;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sticky-category-bar {
  position: sticky;
  top: var(--header-height);
  z-index: var(--z-sticky);
}

.table-content {
  flex: 1;
  padding: 16px;
  padding-bottom: 80px;

  @include md {
    padding: 24px;
    padding-bottom: 80px;
  }
}
</style>
