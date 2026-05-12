<template>
  <div class="table-layout-root">
    <header class="table-header">
      <img
        v-if="logo"
        :src="logo"
        :alt="tenantName"
        class="logo"
      >
      <span v-else class="tenant-name">{{ tenantName }}</span>
      <ClientOnly>
        <span v-if="tableStore.tableName" class="table-badge">{{ tableStore.tableName }}</span>
      </ClientOnly>
    </header>

    <ClientOnly>
      <div class="sticky-category-bar">
        <CategoryBar overflow="scroll" />
      </div>
    </ClientOnly>

    <div class="table-content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import type { Tenant } from '@fastio/shared'
import { useTableStore } from '~/features/table-mode'
import CategoryBar from '~/shared/ui/sections/CategoryBar.vue'

const { data: tenant } = useNuxtData<Tenant>('tenant')
const tableStore = useTableStore()
const logo = computed(() => tenant.value?.siteContent?.logo ?? null)
const tenantName = computed(() => tenant.value?.name ?? '')
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
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
  position: sticky;
  top: 0;
  z-index: 200;

  @include md {
    padding: 16px 24px;
  }
}

.logo {
  height: 32px;
  width: auto;
  object-fit: contain;
}

.tenant-name {
  @include text-body(600);
}

.table-badge {
  margin-left: auto;
  padding: 4px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  @include text-body-sm(600);
  white-space: nowrap;
}

.sticky-category-bar {
  position: sticky;
  top: var(--header-height);
  z-index: 99;
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
