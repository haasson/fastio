<template>
  <div class="layout-root" :class="{ 'sidebar-collapsed': collapsed }">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <UiConfigProvider :is-dark="true">
        <div class="sidebar-header">
          <NuxtLink to="/" class="logo">
            <span class="logo-text">Fast<span class="logo-accent">io</span></span>
          </NuxtLink>
          <a
            v-if="siteUrl"
            :href="siteUrl"
            target="_blank"
            class="site-link"
            title="Открыть сайт"
          >
            <UiIcon name="externalLink" :size="15" />
          </a>
        </div>

        <div class="nav-scroll">
          <AppNav :collapsed="collapsed && !sidebarOpen" @navigate="sidebarOpen = false" />
        </div>

        <div class="user-info">
          <TenantSwitcher />
          <BranchSelector />

          <NuxtLink to="/account" class="account-link" @click="sidebarOpen = false">
            <UiIcon v-if="showAccountIcon" name="users" :size="18" />
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
        <div class="page-title-wrap">
          <UiTitle size="h3">{{ pageTitle }}</UiTitle>
          <a
            v-if="kbUrl"
            :href="kbUrl"
            target="_blank"
            class="kb-btn"
            title="База знаний"
          >
            <UiIcon name="graduationCap" :size="15" />
          </a>
        </div>
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
import { useRoute, useRuntimeConfig } from '#imports'
import { KB_ROUTES } from '@fastio/kb'
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

const siteUrl = computed(() => {
  const t = tenantStore.tenant

  if (!t) return null

  return t.customDomain ? `https://${t.customDomain}` : `https://${t.slug}.fastio.ru`
})

const showAccountIcon = computed(() => collapsed.value && !sidebarOpen.value)

const showOnboarding = computed(
  () => !tenantStore.loading && !!tenantStore.tenant && !tenantStore.tenant.onboardingCompleted,
)

const userName = computed(() => authStore.user?.user_metadata?.full_name || authStore.user?.email || '')
const userRole = computed(() => tenantStore.currentRoleName ?? '')

const pageTitle = usePageTitle()

const route = useRoute()
const helpBaseUrl = useRuntimeConfig().public.helpUrl

const kbUrl = computed(() => {
  const path = route.path === '/' ? '/dashboard' : route.path
  const matched = KB_ROUTES.find((r) => path.startsWith(r.route))

  if (!matched?.kbSection) return null

  return `${helpBaseUrl}/${matched.kbSection}`
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;
@use '@fastio/styles/mixins/layout' as *;

.layout-root {
  --topbar-height: 60px;
  --content-padding: var(--space-24);
  --sidebar-width: 240px;
  --sidebar-width-collapsed: 64px;

  display: flex;
  min-height: 100vh;
  background: var(--color-bg-page);
}

.sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  background: var(--grey-900);
  border-right: 1px solid var(--grey-700);
  color: var(--grey-300);
  display: flex;
  flex-direction: column;
  padding: 0 0 var(--space-16);
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
  @include flex-row(0);

  height: var(--topbar-height);
  padding: 0 var(--space-16);
  border-bottom: 1px solid var(--grey-700);
  flex-shrink: 0;
}

.logo {
  @include flex-row(var(--space-8));

  text-decoration: none;
  color: var(--grey-50);
}

// Логотип — отдельный кейс: специфичный шрифт Unbounded, нестандартный размер/вес.
// Шкала text-* сюда не подходит, оставляем литералы.
/* stylelint-disable scale-unlimited/declaration-strict-value */
.logo-text {
  font-family: 'Unbounded', sans-serif;
  font-weight: 800;
  font-size: 24px;
  line-height: 1;
  color: var(--grey-50);
}
/* stylelint-enable scale-unlimited/declaration-strict-value */

.logo-accent {
  color: var(--orange-600);
}

.site-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  color: var(--grey-500);
  text-decoration: none;
  transition: color 0.15s;

  &:hover {
    color: var(--grey-200);
  }
}

.nav-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
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
  @include flex-col(var(--space-8));

  padding: var(--space-12) var(--space-16) var(--space-4);
  border-top: 1px solid var(--grey-700);
  margin-top: auto;
}

.account-link {
  @include flex-row(var(--space-8));

  padding: var(--space-8) var(--space-12);
  border-radius: var(--radius-8);
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
  font-weight: var(--font-weight-semibold);
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
    width: var(--sidebar-width-collapsed);
  }

  .sidebar-header {
    justify-content: center;
    padding: 0;
  }

  .logo-text,
  .site-link {
    display: none;
  }

  .user-info {
    padding: var(--space-12) var(--space-8) var(--space-4);
  }

  .user-info .switcher-root,
  .user-info .branch-selector-root,
  .user-names {
    display: none;
  }

  .account-link {
    justify-content: center;
    padding: var(--space-8) 0;
  }

  .sidebar.open {
    width: var(--sidebar-width);

    .logo-text { display: block; }
    .site-link { display: inline-flex; }
    .user-info { padding: var(--space-12) var(--space-16) var(--space-4); }

    .user-info .switcher-root,
    .user-info .branch-selector-root,
    .user-names { display: revert; }

    .account-link {
      justify-content: flex-start;
      padding: var(--space-8) var(--space-12);
    }
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
    margin-left: var(--sidebar-width);
  }
}

.sidebar-collapsed .main {
  @include mq-m {
    margin-left: var(--sidebar-width-collapsed);
  }
}

.topbar {
  @include flex-row(var(--space-16));

  height: var(--topbar-height);
  background: var(--color-bg-card);
  border-bottom: 1px solid var(--color-border);
  padding: 0 var(--space-24);
  position: sticky;
  top: 0;
  z-index: 50;
}

.page-title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.kb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-6);
  color: var(--color-text-hint);
  opacity: 0.55;
  text-decoration: none;
  transition: opacity var(--transition-fast), background var(--transition-fast);

  &:hover {
    opacity: 1;
    background: var(--color-bg-hover);
  }
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
