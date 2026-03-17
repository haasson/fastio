<template>
  <SfSection as="header" class="header-root" style="--section-spacing: 12px">
    <div class="header-inner">
      <img v-if="tenant?.siteContent?.logo" class="logo" :src="tenant.siteContent.logo" :alt="tenant.name" />
      <span v-else class="logo-fallback">{{ tenant?.name ?? '' }}</span>

      <nav v-if="header.showNav" class="nav">
        <a
          v-for="item in header.navItems"
          :key="item.page"
          class="nav-link"
          :href="item.placement === 'page' ? `/${item.page}` : `#${item.page}`"
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

        <button
          class="burger"
          :class="{ 'burger--active': menuOpen }"
          :aria-label="menuOpen ? 'Закрыть' : 'Меню'"
          @click="menuOpen = !menuOpen"
        >
          <span class="burger-line" />
          <span class="burger-line" />
          <span class="burger-line" />
        </button>
      </div>
    </div>
  </SfSection>

  <Teleport to="body">
    <Transition name="mobile-menu">
      <div v-if="menuOpen" class="mobile-menu" @click.self="menuOpen = false">
        <nav v-if="header.showNav && header.navItems.length" class="mobile-nav">
          <a
            v-for="item in header.navItems"
            :key="item.page"
            class="mobile-nav-link"
            :href="item.placement === 'page' ? `/${item.page}` : `#${item.page}`"
            @click="menuOpen = false"
          >
            {{ featureLabel(item.page) }}
          </a>
        </nav>

        <div v-if="header.showPhone || header.showWorkingHours" class="mobile-venue">
          <a v-if="header.showPhone" class="mobile-phone" :href="`tel:${tenant?.contacts?.phone}`">
            {{ tenant?.contacts?.phone }}
          </a>
          <span v-if="header.showWorkingHours" class="mobile-hours">{{ tenant?.workingHours }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { ShoppingCart } from 'lucide-vue-next'
import type { Tenant, SiteLayout } from '@fastio/shared'
import { featureLabel } from '@fastio/shared'
import SfSection from '~/components/sf/layout/SfSection.vue'
import SfIconButton from '~/components/sf/base/SfIconButton.vue'

defineProps<{
  tenant: Tenant | null
  header: SiteLayout['header']
}>()

const menuOpen = ref(false)

watch(menuOpen, (open) => {
  if (import.meta.client) {
    document.body.style.overflow = open ? 'hidden' : ''
  }
})

onUnmounted(() => {
  if (import.meta.client) document.body.style.overflow = ''
})
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
  display: none;
  gap: 20px;
  flex: 1;

  @include md { display: flex; }
}

.nav-link {
  font-size: 14px;
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

// ─── Burger ───────────────────────────────────────────────────────────────────

.burger {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  flex-shrink: 0;

  @include md { display: none; }
}

.burger-line {
  width: 22px;
  height: 2px;
  border-radius: 2px;
  background: var(--primary);
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.burger--active {
  .burger-line:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  .burger-line:nth-child(2) { opacity: 0; }
  .burger-line:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
}

// ─── Mobile menu ─────────────────────────────────────────────────────────────

.mobile-menu {
  position: fixed;
  inset: 0;
  z-index: 150;
  background: var(--color-bg);
  display: flex;
  flex-direction: column;
  padding: 80px 24px 40px;
  overflow-y: auto;
  font-family: var(--font-family);

  @include md { display: none; }
}

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

// ─── Transition ───────────────────────────────────────────────────────────────

.mobile-menu-enter-active,
.mobile-menu-leave-active {
  transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

.mobile-menu-enter-from,
.mobile-menu-leave-to {
  opacity: 0;
  transform: translateY(-16px);
}
</style>
