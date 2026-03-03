<template>
  <div class="layout-root" :class="{ 'sidebar-collapsed': collapsed }">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <UiAppLogo :size="28" />
        <UiTitle size="h1" class="logo-text">Fastio</UiTitle>
      </div>

      <div class="tenant-wrap">
        <TenantSwitcher />
      </div>

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

      <div class="user-info">
        <UiText size="small" class="user-tenant">{{ tenantStore.tenant?.name }}</UiText>
        <UiText size="tiny" class="user-name">{{ displayName }}</UiText>
      </div>

      <button class="collapse-btn" @click="collapsed = !collapsed">
        <UiIcon name="collapse" :size="14" :rotate="collapsed ? 180 : 0" />
      </button>
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
        <UiTitle size="h3">{{ currentPageTitle }}</UiTitle>
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
import { useRoute } from '#imports'
import { useLocalStorage } from '@vueuse/core'
import { UiIcon, UiConfirmModal, UiTitle, UiText } from '@fastio/ui'
import type { IconName } from '@fastio/ui'
import TenantSwitcher from '~/components/TenantSwitcher.vue'
import UiAppLogo from '~/components/ui/AppLogo.vue'
import UiAppBurger from '~/components/ui/AppBurger.vue'
import { usePermissions } from '~/composables/usePermissions'
import { useAuthStore } from '~/stores/auth'
import { useTenantStore } from '~/stores/tenant'
import { roleLabels } from '~/config/team-roles'

const route = useRoute()
const sidebarOpen = ref(false)
const collapsed = useLocalStorage('sidebar-collapsed', false)
const { canManageMenu, canManageOrders, canManagePromotions, canViewSettings } = usePermissions()

const authStore = useAuthStore()
const tenantStore = useTenantStore()

const displayName = computed(() => {
  const name = authStore.user?.user_metadata?.full_name || authStore.user?.email || ''
  const role = tenantStore.currentRole ? roleLabels[tenantStore.currentRole] : ''

  return role ? `${name} (${role})` : name
})

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
  background: var(--blue-50);
  border-right: 1px solid var(--blue-200);
  display: flex;
  flex-direction: column;
  padding: 0 0 16px;
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  z-index: 100;
  transition: transform 0.25s ease, width 0.25s ease;
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
  border-bottom: 1px solid var(--blue-200);
  margin-bottom: 8px;
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
  color: var(--grey-700);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: var(--blue-100);
    color: var(--grey-900);
  }

  &.active {
    background: var(--color-primary);
    color: var(--color-white);
  }
}

.collapse-btn {
  display: none;
  align-items: center;
  justify-content: center;
  position: absolute;
  right: -12px;
  top: 60px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--blue-200);
  background: var(--color-white);
  color: var(--grey-500);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  z-index: 1;

  &:hover {
    background: var(--blue-50);
    color: var(--grey-900);
  }

  @include mq-m {
    display: flex;
  }
}

.user-info {
  padding: 12px 20px 4px;
  border-top: 1px solid var(--blue-200);
  margin-top: auto;
  overflow: hidden;
}

.user-tenant {
  display: block;
  font-weight: 600;
  color: var(--color-title);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-name {
  display: block;
  color: var(--grey-500);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-collapsed {
  .sidebar {
    width: 64px;
  }

  .logo-text,
  .tenant-wrap,
  .nav-item span,
  .user-info {
    display: none;
  }

  .sidebar-header {
    justify-content: center;
    padding: 24px 0 20px;
  }

  .nav-item {
    justify-content: center;
    padding: 10px 0;
  }

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
  transition: margin-left 0.25s ease;

  @include mq-m {
    margin-left: 240px;
  }
}

.sidebar-collapsed .main {
  @include mq-m {
    margin-left: 64px;
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
