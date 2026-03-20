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
          :key="link.page"
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

        <FsIconButton aria-label="Корзина">
          <ShoppingCart :size="20" :stroke-width="1.7" />
        </FsIconButton>

        <FsBurger v-model="menuOpen" style="--burger-color: var(--primary)" />
      </div>
    </div>
  </FsSection>

  <FsMobileMenu v-model="menuOpen">
    <nav v-if="header.showNav && navLinks.length" class="mobile-nav">
      <NuxtLink
        v-for="link in navLinks"
        :key="link.page"
        class="mobile-nav-link"
        :to="link.to"
        @click="menuOpen = false"
      >
        {{ link.label }}
      </NuxtLink>
    </nav>

    <div v-if="header.showPhone || header.showWorkingHours" class="mobile-venue">
      <a v-if="header.showPhone" class="mobile-phone" :href="`tel:${tenant?.contacts?.phone}`">
        {{ tenant?.contacts?.phone }}
      </a>
      <span v-if="header.showWorkingHours" class="mobile-hours">{{ tenant?.workingHours }}</span>
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

const props = defineProps<{
  tenant: Tenant | null
  header: SiteLayout['header']
}>()

const route = useRoute()

const navLinks = computed(() =>
  props.header.navItems.map((item) => ({
    page: item.page,
    label: featureLabel(item.page),
    to: item.placement === 'page'
      ? { path: `/${item.page}`, query: route.query }
      : `#${item.page}`,
  })),
)

const menuOpen = ref(false)
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.header-root {
  background: var(--color-bg);
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-link {
  display: inline-flex;
  flex-shrink: 0;
  text-decoration: none;
}

.logo {
  height: 36px;
  width: auto;
  object-fit: contain;
}

.logo-fallback {
  font-size: 18px;
  font-weight: 700;
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
  font-size: 16px;
  font-weight: 500;
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
  font-size: 12px;
  color: var(--color-text-secondary);
}

.venue-phone {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  text-decoration: none;
}

// ─── Mobile menu content ────────────────────────────────────────────────────

.mobile-nav {
  display: flex;
  flex-direction: column;
}

.mobile-nav-link {
  display: block;
  font-family: inherit;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  text-decoration: none;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border);
  transition: color 0.15s;

  &:first-child { border-top: 1px solid var(--color-border); }
  &:hover { color: var(--primary); }
}

.mobile-venue {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: auto;
  padding-top: 32px;
}

.mobile-phone {
  font-family: inherit;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  text-decoration: none;
}

.mobile-hours {
  font-family: inherit;
  font-size: 14px;
  color: var(--color-text-secondary);
}
</style>
