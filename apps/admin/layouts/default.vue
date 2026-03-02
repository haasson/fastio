<template>
  <div class="layout-root">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <span class="logo-icon">🍔</span>
        <span class="logo-text">FastFood SaaS</span>
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

      <UiButton class="logout" type="text" dark-side full-width icon="logOut" @click="handleLogout">
        Выйти
      </UiButton>
    </aside>

    <!-- Overlay для мобилки -->
    <div v-if="sidebarOpen" class="overlay" @click="sidebarOpen = false" />

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
import { signOut } from 'firebase/auth'
import { UiButton, UiIcon } from '@fastfood-saas/ui'
import type { IconName } from '@fastfood-saas/ui'

const { $auth } = useNuxtApp()
const route = useRoute()
const sidebarOpen = ref(false)

const navItems: { to: string; icon: IconName; label: string }[] = [
  { to: '/', icon: 'dashboard', label: 'Дашборд' },
  { to: '/menu', icon: 'dishes', label: 'Меню' },
  { to: '/orders', icon: 'orders', label: 'Заказы' },
  { to: '/promotions', icon: 'promotions', label: 'Акции' },
  { to: '/settings', icon: 'settings', label: 'Настройки' },
]

const currentPageTitle = computed(() => {
  return navItems.find((item) => item.to === route.path)?.label ?? ''
})

async function handleLogout() {
  await signOut($auth)
  await navigateTo('/login')
}
</script>

<style scoped lang="scss">
@use '@fastfood-saas/ui/styles/mixins/media-queries' as *;

.layout-root {
  display: flex;
  min-height: 100vh;
  background: #f7f7f8;
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

.logo-icon {
  font-size: 24px;
}

.logo-text {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
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
    color: #fff;
  }

  &.active {
    background: #ff6b35;
    color: #fff;
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
  background: #fff;
  border-bottom: 1px solid #efefef;
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
  color: #111;
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
