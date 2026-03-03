<template>
  <div class="layout-root">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <UiAppLogo :size="28" />
        <span class="logo-text">Fastio</span>
      </div>

      <TenantSwitcher />

      <nav class="nav">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          active-class="active"
          @click="sidebarOpen = false"
        >
          <UiIcon :name="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <UiButton
        class="logout"
        type="text"
        dark-side
        full-width
        icon="logOut"
        @click="handleLogout"
      >
        Выйти
      </UiButton>
    </aside>

    <!-- Overlay для мобилки -->
    <div v-if="sidebarOpen" class="overlay" @click="sidebarOpen = false" />

    <UiConfirmModal />

    <!-- Main -->
    <div class="main">
      <header class="topbar">
        <div class="burger-wrap">
          <UiAppBurger :open="sidebarOpen" @click="sidebarOpen = !sidebarOpen" />
        </div>
        <span class="page-title">{{ currentPageTitle }}</span>
      </header>

      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useNuxtApp, useRoute, navigateTo } from '#imports'
import { UiButton, UiIcon, UiConfirmModal } from '@fastio/ui'
import type { IconName } from '@fastio/ui'
import TenantSwitcher from '~/components/TenantSwitcher.vue'
import UiAppLogo from '~/components/ui/AppLogo.vue'
import UiAppBurger from '~/components/ui/AppBurger.vue'
import { usePermissions } from '~/composables/usePermissions'
import { useTenantStore } from '~/stores/tenant'

const { $supabase } = useNuxtApp()
const route = useRoute()
const sidebarOpen = ref(false)
const tenantStore = useTenantStore()
const { canManageMenu, canManageOrders, canManagePromotions, canViewSettings } = usePermissions()

type NavItem = { to: string; icon: IconName; label: string; visible?: ComputedRef<boolean> }

const allNavItems: NavItem[] = [
  { to: '/', icon: 'dashboard', label: 'Дашборд' },
  { to: '/menu', icon: 'dishes', label: 'Меню', visible: canManageMenu },
  { to: '/orders', icon: 'orders', label: 'Заказы', visible: canManageOrders },
  { to: '/promotions', icon: 'promotions', label: 'Акции', visible: canManagePromotions },
  { to: '/settings', icon: 'settings', label: 'Настройки', visible: canViewSettings },
]

const navItems = computed(() => allNavItems.filter((item) => !item.visible || item.visible.value),
)

const currentPageTitle = computed(() => navItems.value.find((item) => item.to === route.path)?.label ?? '')

const handleLogout = async () => {
  tenantStore.dispose()
  await $supabase.auth.signOut()
  await navigateTo('/login')
}
</script>

<style scoped lang="scss">
@use '@fastio/ui/styles/mixins/media-queries' as *;

.layout-root {
  display: flex;
  min-height: 100vh;
  background: var(--color-bg-page);
}

.sidebar {
  width: 240px;
  flex-shrink: 0;
  background: #1a1a2e;
  display: flex;
  flex-direction: column;
  padding: 0 0 16px;
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  z-index: 100;
  transition: transform 0.25s ease;
  transform: translateX(-100%);

  &.open {
    transform: translateX(0);
  }

  @include mq-m {
    transform: none;
  }
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 24px 20px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 8px;
}

.logo-text {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-white);
}

.nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 10px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-white);
  }

  &.active {
    background: var(--color-primary);
    color: var(--color-white);
  }
}

.logout {
  margin: 0 10px;
  justify-content: flex-start;
}

.burger-wrap {
  display: flex;
  align-items: center;

  @include mq-m {
    display: none;
  }
}

.main {
  flex: 1;
  margin-left: 0;
  display: flex;
  flex-direction: column;
  min-height: 100vh;

  @include mq-m {
    margin-left: 240px;
  }
}

.topbar {
  height: 60px;
  background: var(--color-bg-card);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 50;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-title);
}

.content {
  flex: 1;
  padding: 24px;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 99;

  @include mq-m {
    display: none;
  }
}
</style>
