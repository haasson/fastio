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
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <button class="logout" @click="handleLogout">
        <span class="nav-icon">↩</span>
        <span class="nav-label">Выйти</span>
      </button>
    </aside>

    <!-- Overlay для мобилки -->
    <div v-if="sidebarOpen" class="overlay" @click="sidebarOpen = false" />

    <!-- Main -->
    <div class="main">
      <header class="topbar">
        <button class="burger" @click="sidebarOpen = !sidebarOpen">
          <span />
          <span />
          <span />
        </button>
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

const { $auth } = useNuxtApp()
const route = useRoute()
const sidebarOpen = ref(false)

const navItems = [
  { to: '/', icon: '📊', label: 'Дашборд' },
  { to: '/menu', icon: '🍔', label: 'Меню' },
  { to: '/orders', icon: '📋', label: 'Заказы' },
  { to: '/promotions', icon: '🎁', label: 'Акции' },
  { to: '/settings', icon: '⚙️', label: 'Настройки' },
]

const currentPageTitle = computed(() => {
  return navItems.find((item) => item.to === route.path)?.label ?? ''
})

async function handleLogout() {
  await signOut($auth)
  await navigateTo('/login')
}
</script>

<style scoped>
.layout-root {
  display: flex;
  min-height: 100vh;
  background: #f7f7f8;
}

/* ─── Sidebar ─── */
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

.nav-item,
.logout {
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
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
}

.nav-item:hover,
.logout:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.nav-item.active {
  background: #ff6b35;
  color: #fff;
}

.nav-icon {
  font-size: 18px;
  width: 22px;
  text-align: center;
}

.logout {
  margin: 0 10px;
}

/* ─── Main ─── */
.main {
  flex: 1;
  margin-left: 240px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
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

/* ─── Burger (мобилка) ─── */
.burger {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
}

.burger span {
  display: block;
  width: 22px;
  height: 2px;
  background: #333;
  border-radius: 2px;
}

.overlay {
  display: none;
}

/* ─── Адаптив ─── */
@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .main {
    margin-left: 0;
  }

  .burger {
    display: flex;
  }

  .overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 99;
  }
}
</style>
