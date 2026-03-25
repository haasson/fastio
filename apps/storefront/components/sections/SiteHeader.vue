<template>
  <FsSection as="header" class="header-root" style="--section-spacing: 12px">
    <div class="header-inner">
      <NuxtLink :to="{ path: '/', query: route.query }" class="logo-link">
        <img v-if="tenant?.siteContent?.logo" class="logo" :src="tenant.siteContent.logo" :alt="tenant.name" />
        <span v-else class="logo-fallback">{{ tenant?.name ?? '' }}</span>
      </NuxtLink>

      <nav v-if="header.showNav" class="nav">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.key"
          class="nav-link"
          :to="link.to"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>

      <div class="right">
        <div v-if="header.showPhone || header.showWorkingHours" class="venue-info">
          <span v-if="header.showWorkingHours" class="venue-hours">{{ tenant?.workingHours }}</span>
          <a v-if="header.showPhone" class="venue-phone" :href="`tel:${tenant?.contacts?.phone}`">
            {{ tenant?.contacts?.phone }}
          </a>
        </div>

        <HeaderUserMenu />


        <FsIconButton ariaLabel="Корзина">
          <ShoppingCart :size="20" :stroke-width="1.7" />
        </FsIconButton>

        <FsBurger v-model="menuOpen" style="--burger-color: var(--primary)" />
      </div>
    </div>
  </FsSection>

  <FsMobileMenu v-model="menuOpen">
    <nav v-if="header.showNav && navLinks.length" class="mm-nav">
      <NuxtLink
        v-for="link in navLinks"
        :key="link.key"
        class="mm-nav-link"
        :to="link.to"
        @click="menuOpen = false"
      >
        {{ link.label }}
      </NuxtLink>
    </nav>

    <div class="mm-footer">
      <div v-if="header.showPhone || header.showWorkingHours" class="mm-venue">
        <a v-if="header.showPhone" class="mm-venue-phone" :href="`tel:${tenant?.contacts?.phone}`">
          {{ tenant?.contacts?.phone }}
        </a>
        <span v-if="header.showWorkingHours" class="mm-venue-hours">{{ tenant?.workingHours }}</span>
      </div>

      <MobileUserCard @close="menuOpen = false" />
    </div>
  </FsMobileMenu>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'nuxt/app'
import { ShoppingCart } from 'lucide-vue-next'
import type { Tenant, SiteLayout } from '@fastio/shared'
import { featureLabel } from '@fastio/shared'
import { FsSection, FsIconButton, FsBurger, FsMobileMenu } from '@fastio/public-ui'
import HeaderUserMenu from '~/components/HeaderUserMenu.vue'
import MobileUserCard from '~/components/MobileUserCard.vue'

const props = defineProps<{
  tenant: Tenant | null
  header: SiteLayout['header']
}>()

const route = useRoute()

const navLinks = computed(() =>
  props.header.navItems.map((item) => ({
    key: item.key,
    label: featureLabel(item.key),
    to: item.action === 'navigate'
      ? { path: `/${item.key}`, query: route.query }
      : `#${item.key}`,
  })),
)

const menuOpen = ref(false)
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.header-root {
  position: relative;
  z-index: var(--z-header);
  height: var(--header-height);
  padding-block: 0;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);

  :deep(.container) {
    height: 100%;
  }
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 100%;
}

.logo-link {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  height: 36px;
  min-width: 80px;
  text-decoration: none;
}

.logo {
  height: 36px;
  width: auto;
  max-width: 160px;
  object-fit: contain;
}

.logo-fallback {
  @include text-body(700);
  color: var(--color-text);
  flex-shrink: 0;
}

.nav {
  display: none;
  justify-content: center;
  gap: 24px;
  flex: 1;

  @include md { display: flex; }
}

.nav-link {
  @include text-body-sm(500);
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color 0.15s;

  &:hover { color: var(--color-text); }
}

.right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.venue-info {
  display: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;

  @include md { display: flex; }
}

.venue-hours {
  @include text-xs;
  color: var(--color-text-secondary);
}

.venue-phone {
  @include text-caption(600);
  color: var(--color-text);
  text-decoration: none;
}


// ─── Mobile menu ─────────────────────────────────────────────────────────────

.mm-nav {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.mm-nav-link {
  @include text-body(600);
  color: var(--color-text);
  text-decoration: none;
  padding: 14px 0;
  transition: color 0.15s;

  &:hover { color: var(--primary); }

  &.router-link-active { color: var(--primary); }
}

// ─── Footer ──────────────────────────────────────────────────────────────────

.mm-footer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 24px;
  border-top: 1px solid var(--color-border);
}

.mm-venue {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mm-venue-phone {
  @include text-body-sm(600);
  color: var(--color-text);
  text-decoration: none;
}

.mm-venue-hours {
  @include text-xs;
  color: var(--color-text-secondary);
}

</style>
