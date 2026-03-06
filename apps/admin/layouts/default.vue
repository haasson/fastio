<template>
  <div class="layout-root" :class="{ 'sidebar-collapsed': collapsed }">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <UiConfigProvider :is-dark="true">
        <div class="sidebar-header">
          <UiAppLogo :size="28" />
          <UiTitle size="h1" class="logo-text">Fastio</UiTitle>
        </div>

        <div class="tenant-wrap">
          <TenantSwitcher />
        </div>

        <AppNav :collapsed="collapsed" @navigate="sidebarOpen = false" />

        <div class="user-info">
          <UiSelect
            v-if="branchStore.hasBranches"
            :value="branchStore.currentBranchId ?? ''"
            :options="branchOptions"
            class="branch-select"
            @update:value="handleBranchChange"
          />

          <div class="user-row">
            <div class="user-names">
              <UiText size="small" class="user-tenant">{{ tenantStore.tenant?.name }}</UiText>
              <UiText size="tiny" class="user-name">{{ displayName }}</UiText>
            </div>
            <UiButton
              type="text"
              size="small"
              icon="logOut"
              class="logout-btn"
              @click="handleLogout"
            />
          </div>
        </div>

        <button class="collapse-btn" @click="collapsed = !collapsed">
          <UiIcon name="collapse" :size="14" :rotate="collapsed ? 180 : 0" />
        </button>
      </UiConfigProvider>
    </aside>

    <!-- Overlay для мобилки -->
    <div v-if="sidebarOpen" class="overlay" @click="sidebarOpen = false" />

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
import { useRoute, useNuxtApp, navigateTo } from '#imports'
import { useLocalStorage } from '@vueuse/core'
import { UiConfigProvider, UiTitle, UiText, UiSelect, UiButton, UiIcon, useConfirm } from '@fastio/ui'
import TenantSwitcher from '~/components/TenantSwitcher.vue'
import AppNav from '~/components/layout/AppNav.vue'
import UiAppLogo from '~/components/ui/AppLogo.vue'
import UiAppBurger from '~/components/ui/AppBurger.vue'
import { useAuthStore } from '~/stores/auth'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { roleLabels } from '~/config/team-roles'

const route = useRoute()
const { $supabase } = useNuxtApp()
const { confirm } = useConfirm()
const sidebarOpen = ref(false)
const collapsed = useLocalStorage('sidebar-collapsed', false)

const authStore = useAuthStore()
const tenantStore = useTenantStore()
const branchStore = useBranchStore()

const displayName = computed(() => {
  const name = authStore.user?.user_metadata?.full_name || authStore.user?.email || ''
  const role = tenantStore.currentRole ? roleLabels[tenantStore.currentRole] : ''

  return role ? `${name} (${role})` : name
})

// Branch select
const currentMember = computed(() => tenantStore.memberships.find((m) => m.tenantId === tenantStore.currentTenantId),
)

const canSeeAll = computed(() => {
  const role = tenantStore.currentRole

  if (role === 'owner' || role === 'admin') return true

  return (currentMember.value?.branchIds ?? []).length === 0
})

const availableBranches = computed(() => {
  const memberBranchIds = currentMember.value?.branchIds ?? []

  if (canSeeAll.value) return branchStore.branches

  return branchStore.branches.filter((b) => memberBranchIds.includes(b.id))
})

const branchOptions = computed(() => {
  const opts: { label: string; value: string }[] = []

  if (canSeeAll.value) {
    opts.push({ label: 'Все филиалы', value: '' })
  }

  availableBranches.value.forEach((b) => {
    opts.push({ label: b.name, value: b.id })
  })

  return opts
})

const handleBranchChange = (val: string) => {
  branchStore.setBranch(val === '' ? null : val)
}

// Logout
const handleLogout = async () => {
  const confirmed = await confirm({
    title: 'Выйти из аккаунта?',
    message: 'Вы будете перенаправлены на страницу входа',
    confirmText: 'Выйти',
    confirmType: 'error',
  })

  if (!confirmed) return

  tenantStore.dispose()
  await $supabase.auth.signOut()
  await navigateTo('/login')
}

const pageTitles: Record<string, string> = {
  '/': 'Дашборд',
  '/menu': 'Меню',
  '/orders': 'Заказы',
  '/promotions': 'Акции',
  '/settings': 'Настройки',
}

const currentPageTitle = computed(() => pageTitles[route.path] ?? '')
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
  background: var(--grey-900);
  border-right: 1px solid var(--grey-700);
  color: var(--grey-300);
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

  :deep(> .n-config-provider) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;

    > .n-message-provider { // naive adds this wrapper
      display: contents;
    }
  }

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
  border-bottom: 1px solid var(--grey-700);
  margin-bottom: 8px;

  :deep(*) {
    color: var(--grey-50);
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
  border: 1px solid var(--grey-700);
  background: var(--grey-900);
  color: var(--grey-400);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  z-index: 1;

  &:hover {
    background: var(--grey-800);
    color: var(--grey-50);
  }

  @include mq-m {
    display: flex;
  }
}

.user-info {
  padding: 12px 16px 4px;
  border-top: 1px solid var(--grey-700);
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.branch-select {
  width: 100%;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-names {
  flex: 1;
  min-width: 0;
}

.user-tenant {
  display: block;
  font-weight: 600;
  color: var(--grey-50);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-name {
  display: block;
  color: var(--grey-400);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout-btn {
  flex-shrink: 0;
  color: var(--grey-500);

  &:hover {
    color: var(--grey-300);
  }
}

.sidebar-collapsed {
  .sidebar {
    width: 64px;
  }

  .logo-text,
  .tenant-wrap,
  .user-info {
    display: none;
  }

  .sidebar-header {
    justify-content: center;
    padding: 24px 0 20px;
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

.content {
  flex: 1;
  padding: 24px;
}

.overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  z-index: 99;

  @include mq-m {
    display: none;
  }
}
</style>
