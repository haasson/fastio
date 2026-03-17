<template>
  <SfSection as="header" class="header-root">
    <div class="header-inner">
      <img v-if="tenant?.siteContent?.logo" class="logo" :src="tenant.siteContent.logo" :alt="tenant.name" />
      <span v-else class="logo-fallback">{{ tenant?.name ?? '' }}</span>

      <nav v-if="header.showNav" class="nav">
        <a
          v-for="item in header.navItems"
          :key="item.page"
          :href="item.placement === 'page' ? `/${item.page}` : `#${item.page}`"
          class="nav-link"
        >
          {{ featureLabel(item.page) }}
        </a>
      </nav>

      <div class="right">
        <div v-if="header.showPhone || header.showWorkingHours" class="venue-info">
          <span v-if="header.showWorkingHours" class="venue-hours">{{ tenant?.workingHours }}</span>
          <a v-if="header.showPhone" class="venue-phone" :href="`tel:${tenant?.contacts?.phone}`">
            {{ tenant?.contacts?.phone }}
          </a>
        </div>

        <SfIconButton aria-label="Корзина">
          <ShoppingCart :size="20" :stroke-width="1.7" />
        </SfIconButton>
      </div>
    </div>
  </SfSection>
</template>

<script setup lang="ts">
import { ShoppingCart } from 'lucide-vue-next'
import type { Tenant, SiteLayout } from '@fastio/shared'
import { featureLabel } from '@fastio/shared'
import SfSection from '~/components/sf/layout/SfSection.vue'
import SfIconButton from '~/components/sf/base/SfIconButton.vue'

defineProps<{
  tenant: Tenant | null
  header: SiteLayout['header']
}>()
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.header-root {
  background: var(--color-bg);
  padding-block: 12px;
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  height: 36px;
  width: auto;
  object-fit: contain;
  flex-shrink: 0;
}

.logo-fallback {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  flex-shrink: 0;
}

.nav {
  display: flex;
  gap: 20px;
  flex: 1;
}

.nav-link {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color 0.15s;

  &:hover {
    color: var(--color-text);
  }
}

.right {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-left: auto;
}

.venue-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.venue-hours {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.venue-phone {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  text-decoration: none;
}
</style>
