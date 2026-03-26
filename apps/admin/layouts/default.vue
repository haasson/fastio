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

          <NuxtLink to="/account" class="account-link" @click="sidebarOpen = false">
            <UiIcon name="users" :size="18" />
            <div class="user-names">
              <UiText size="small" class="user-tenant">{{ tenantStore.tenant?.name }}</UiText>
              <UiText size="tiny" class="user-name">{{ displayName }}</UiText>
            </div>
          </NuxtLink>
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
      <PastDueBanner />

      <header class="topbar">
        <div class="burger-wrap">
          <UiAppBurger :open="sidebarOpen" @click="sidebarOpen = !sidebarOpen" />
        </div>
        <UiTitle size="h3">{{ currentPageTitle }}</UiTitle>
        <UiButton
          type="text"
          size="small"
          :icon="isDark ? 'sun' : 'moon'"
          class="theme-btn"
          @click="isDark = !isDark"
        />
      </header>

      <main class="content" :class="{ 'content-gate': showBranchGate }">
        <BranchSetupGate v-if="showBranchGate" />
        <slot v-else />
      </main>
    </div>

    <BusinessTypeModal :model-value="showOnboarding" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, type Ref } from 'vue'
import { useRoute, navigateTo } from '#imports'
import { useOrdersChannel } from '~/composables/data/useOrdersChannel'
import { useTableCallsChannel } from '~/composables/data/useTableCallsChannel'
import { useKitchenQueueChannel } from '~/composables/data/useKitchenQueueChannel'
import { useReservationsChannel } from '~/composables/data/useReservationsChannel'
import { useReservationAlertHandler } from '~/composables/data/useReservationAlertHandler'
import { useOrderAlertHandler } from '~/composables/data/useOrderAlertHandler'
import { useTableCallAlertHandler } from '~/composables/data/useTableCallAlertHandler'
import { requestNotificationPermission } from '~/composables/data/useAlerts'
import { useLocalStorage } from '@vueuse/core'
import { UiConfigProvider, UiTitle, UiText, UiSelect, UiButton, UiIcon } from '@fastio/ui'
import TenantSwitcher from '~/components/TenantSwitcher.vue'
import AppNav from '~/components/layout/AppNav.vue'
import BranchSetupGate from '~/components/layout/BranchSetupGate.vue'
import BusinessTypeModal from '~/components/onboarding/BusinessTypeModal.vue'
import PastDueBanner from '~/components/layout/PastDueBanner.vue'
import { useTenantLabels } from '~/composables/plan/useTenantLabels'
import UiAppLogo from '~/components/ui/AppLogo.vue'
import UiAppBurger from '~/components/ui/AppBurger.vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '~/stores/auth'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { roleLabels } from '~/config/team-roles'

const route = useRoute()
const sidebarOpen = ref(false)
const collapsed = useLocalStorage('sidebar-collapsed', false)

const isDark = inject<Ref<boolean>>('isDark', ref(false))

const authStore = useAuthStore()
const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const { currentTenantId } = storeToRefs(tenantStore)

// Уведомления о новых заказах
useOrdersChannel(currentTenantId)
useOrderAlertHandler()

// Вызовы официанта
useTableCallsChannel(currentTenantId)
useTableCallAlertHandler()

// Кухонная очередь
useKitchenQueueChannel(currentTenantId)

// Бронирования
useReservationsChannel(currentTenantId)
useReservationAlertHandler()

// Запрашиваем разрешение на OS-уведомления (нужно для алертов на скрытой вкладке)
requestNotificationPermission()

const showBranchGate = computed(() => !tenantStore.loading && !branchStore.loading && !!tenantStore.tenant && !branchStore.hasBranches,
)
const showOnboarding = computed(() => !tenantStore.loading && !!tenantStore.tenant && tenantStore.tenant.businessType === null)

const { menuLabel } = useTenantLabels()

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

const handleBranchChange = (val: string | number | (string | number)[] | null) => {
  const strVal = String(val ?? '')

  branchStore.setBranch(strVal === '' ? null : strVal)
}

const currentPageTitle = computed(() => {
  const pageTitles: [string, string][] = [
    ['/menu', menuLabel.value],
    ['/orders', 'Заказы'],
    ['/kitchen', 'Кухня'],
    ['/tables', 'Столы'],
    ['/reservations', 'Бронирования'],
    ['/promotions', 'Акции'],
    ['/team/members', 'Команда'],
    ['/team/branches', 'Филиалы'],
    ['/content', 'Контент сайта'],
    ['/appearance', 'Оформление'],
    ['/settings', 'Настройки'],
    ['/account', 'Личный кабинет'],
    ['/', 'Дашборд'],
  ]
  const entry = pageTitles.find(([path]) => route.path === path || route.path.startsWith(`${path}/`))

  return entry?.[1] ?? ''
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.layout-root {
  --topbar-height: 60px;
  --content-padding: 24px;
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

.account-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  text-decoration: none;
  color: var(--grey-400);
  transition: background 0.15s, color 0.15s;
  cursor: pointer;

  &:hover, &.router-link-active {
    background: var(--grey-800);
    color: var(--grey-50);
  }
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
  min-width: 0;
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
  height: var(--topbar-height);
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

.theme-btn {
  margin-left: auto;
  color: var(--color-text-secondary);
}

.content {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  padding: var(--content-padding);

  &.content-gate {
    display: flex;
    padding: 0;
  }
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
