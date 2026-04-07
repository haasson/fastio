<template>
  <div class="layout-root" :class="{ 'sidebar-collapsed': collapsed }">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <UiConfigProvider :is-dark="true">
        <div class="sidebar-header">
          <NuxtLink to="/" class="logo">
            <span class="logo-text">Fast<span class="logo-accent">io</span></span>
          </NuxtLink>
        </div>

        <AppNav :collapsed="collapsed" @navigate="sidebarOpen = false" />

        <div class="user-info">
          <TenantSwitcher />
          <BranchSelector />

          <NuxtLink to="/account" class="account-link" @click="sidebarOpen = false">
            <UiIcon name="users" :size="18" />
            <div class="user-names">
              <UiText size="small" class="user-tenant">{{ tenantStore.tenant?.name }}</UiText>
              <UiText size="tiny" class="user-name">{{ userName }}</UiText>
              <UiText v-if="userRole" size="tiny" class="user-role">{{ userRole }}</UiText>
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
        <UiTitle size="h3">{{ pageTitle }}</UiTitle>
        <UiButton
          type="text"
          size="small"
          :icon="isDark ? 'sun' : 'moon'"
          class="theme-btn"
          @click="isDark = !isDark"
        />
      </header>

      <main class="content">
        <slot />
      </main>
    </div>

    <OnboardingWizard v-if="showOnboarding" />
    <AiChat />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, type Ref } from 'vue'
import { requestNotificationPermission } from '~/composables/data/useAlerts'
import { useLocalStorage } from '@vueuse/core'
import { UiConfigProvider, UiTitle, UiText, UiButton, UiIcon } from '@fastio/ui'
import TenantSwitcher from '~/components/TenantSwitcher.vue'
import AppNav from '~/components/layout/AppNav.vue'
import BranchSelector from '~/components/layout/BranchSelector.vue'
import OnboardingWizard from '~/components/onboarding/OnboardingWizard.vue'
import PastDueBanner from '~/components/layout/PastDueBanner.vue'
import UiAppBurger from '~/components/ui/AppBurger.vue'
import AiChat from '~/components/ai/AiChat.vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '~/stores/auth'
import { useTenantStore } from '~/stores/tenant'
import { useRealtimeChannels } from '~/composables/useRealtimeChannels'
import { usePageTitle } from '~/composables/usePageTitle'

const sidebarOpen = ref(false)
const collapsed = useLocalStorage('sidebar-collapsed', false)

const isDark = inject<Ref<boolean>>('isDark', ref(false))

const authStore = useAuthStore()
const tenantStore = useTenantStore()
const { currentTenantId } = storeToRefs(tenantStore)

useRealtimeChannels(currentTenantId)

// Запрашиваем разрешение на OS-уведомления (нужно для алертов на скрытой вкладке)
if (tenantStore.tenant?.businessType !== 'services') {
  requestNotificationPermission()
}

const showOnboarding = computed(
  () => !tenantStore.loading && !!tenantStore.tenant && !tenantStore.tenant.onboardingCompleted,
)

const userName = computed(() => authStore.user?.user_metadata?.full_name || authStore.user?.email || '')
const userRole = computed(() => tenantStore.currentRoleName ?? '')

const pageTitle = usePageTitle()
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
  height: var(--topbar-height);
  padding: 0 16px;
  border-bottom: 1px solid var(--grey-700);
  flex-shrink: 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--grey-50);
}

.logo-text {
  font-family: 'Unbounded', sans-serif;
  font-weight: 800;
  font-size: 24px;
  line-height: 1;
  color: var(--grey-50);
}

.logo-accent {
  color: #e55a25;
}

.collapse-btn {
  display: none;
  align-items: center;
  justify-content: center;
  position: absolute;
  right: -12px;
  top: 50%;
  transform: translateY(-50%);
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

.user-role {
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

  .sidebar-header {
    justify-content: center;
    padding: 0;
  }

  .logo-text {
    display: none;
  }

  .user-info {
    padding: 12px 8px 4px;
  }

  .user-info .switcher-root,
  .user-info .branch-selector-root,
  .user-names {
    display: none;
  }

  .account-link {
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
