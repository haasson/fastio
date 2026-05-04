<template>
  <FsSection as="header" class="header-root" style="--section-spacing: 12px">
    <div class="header-inner">
      <NuxtLink :to="{ path: '/', query: route.query }" class="logo-link">
        <img v-if="tenant?.siteContent?.logo" class="logo" :src="tenant.siteContent.logo" :alt="tenant.name" >
        <span v-else class="logo-fallback">{{ tenant?.name ?? '' }}</span>
      </NuxtLink>

      <nav v-if="header.showNav" class="nav">
        <!-- active-class/exact-active-class отключены: scroll-ссылки (/#menu) матчат "/" и светятся некорректно -->
        <NuxtLink
          v-for="link in navLinks"
          :key="link.key"
          class="nav-link"
          :class="{ 'nav-link--active': isLinkActive(link) }"
          active-class=""
          exact-active-class=""
          :to="link.to"
          @click.prevent="handleNavClick(link)"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>

      <div class="right">
        <button
          v-if="showBranchPill"
          class="branch-pill"
          type="button"
          aria-label="Сменить филиал"
          @click="branchPickerRef?.open()"
        >
          <Store :size="14" :stroke-width="1.7" />
          <span class="pill-label">{{ currentBranchName }}</span>
          <ChevronDown :size="12" :stroke-width="1.7" />
        </button>

        <div v-if="header.showPhone || header.showWorkingHours" class="venue-info">
          <span v-if="header.showWorkingHours" class="venue-hours">{{ formattedHours }}</span>
          <a v-if="header.showPhone" class="venue-phone" :href="`tel:${tenant?.contacts?.phone}`">
            {{ tenant?.contacts?.phone }}
          </a>
        </div>

        <HeaderUserMenu v-if="tenant?.modules?.customers" />

        <FsBurger v-model="menuOpen" style="--burger-color: var(--primary)" />
      </div>
    </div>
  </FsSection>

  <BranchPickerModal ref="branchPickerRef" />

  <FsMobileMenu v-model="menuOpen">
    <nav v-if="header.showNav && navLinks.length" class="mm-nav">
      <NuxtLink
        v-for="link in navLinks"
        :key="link.key"
        class="mm-nav-link"
        :class="{ 'mm-nav-link--active': isLinkActive(link) }"
        active-class=""
        exact-active-class=""
        :to="link.to"
        @click.prevent="handleNavClick(link)"
      >
        {{ link.label }}
      </NuxtLink>
    </nav>

    <div class="mm-footer">
      <div v-if="header.showPhone || header.showWorkingHours" class="mm-venue">
        <a v-if="header.showPhone" class="mm-venue-phone" :href="`tel:${tenant?.contacts?.phone}`">
          {{ tenant?.contacts?.phone }}
        </a>
        <span v-if="header.showWorkingHours" class="mm-venue-hours">{{ formattedHours }}</span>
      </div>

      <MobileUserCard v-if="tenant?.modules?.customers" @close="menuOpen = false" />
    </div>
  </FsMobileMenu>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, navigateTo, useNuxtData } from 'nuxt/app'
import { Store, ChevronDown } from 'lucide-vue-next'
import type { BranchPublic, Tenant, SiteLayout } from '@fastio/shared'
import { featureLabel, isFeatureAvailable, formatWorkingHours } from '@fastio/shared'
import { FsSection, FsBurger, FsMobileMenu } from '@fastio/public-ui'
import HeaderUserMenu from '~/components/HeaderUserMenu.vue'
import MobileUserCard from '~/components/MobileUserCard.vue'
import BranchPickerModal from '~/components/branch/BranchPickerModal.vue'
import { useSelectedBranchStore } from '~/stores/selectedBranch'

const props = defineProps<{
  tenant: Tenant | null
  header: SiteLayout['header']
}>()

const route = useRoute()

const branchStore = useSelectedBranchStore()
const branchPickerRef = ref<InstanceType<typeof BranchPickerModal> | null>(null)
const { data: branchesData } = useNuxtData<BranchPublic[]>('branches')

const showBranchPill = computed(
  () => props.tenant?.branchSelectionMode === 'per_branch' && branchStore.id !== null,
)

const currentBranchName = computed(
  () => branchesData.value?.find((b) => b.id === branchStore.id)?.name ?? 'Филиал',
)

const formattedHours = computed(() => formatWorkingHours(props.tenant?.workingHoursSchedule))

const navLinks = computed(() =>
  props.header.navItems
    .filter((item) => !props.tenant?.modules || isFeatureAvailable(item.key, props.tenant.modules))
    .map((item) => ({
      key: item.key,
      label: featureLabel(item.key),
      isScroll: item.action === 'scroll',
      to: item.action === 'navigate'
        ? { path: `/${item.key}`, query: route.query }
        : { path: '/', hash: `#${item.key}`, query: route.query },
    })),
)

const isLinkActive = (link: { isScroll: boolean; to: { path: string } }) => {
  if (link.isScroll) return false
  return route.path === link.to.path
}

const menuOpen = ref(false)

type NavLink = { key: string; label: string; to: { path: string; hash?: string; query?: object } }

const scrollToHash = (hash: string) => {
  const el = document.querySelector(hash)
  if (!el) return false
  const top = el.getBoundingClientRect().top + window.scrollY - 72
  window.scrollTo({ top, behavior: 'smooth' })
  return true
}

const handleNavClick = async (link: NavLink) => {
  menuOpen.value = false

  if (!link.to.hash) {
    // @ts-expect-error Nuxt router type causes excessive stack depth
    await navigateTo(link.to)
    return
  }

  if (route.path === '/') {
    scrollToHash(link.to.hash)
    return
  }

  // @ts-expect-error Nuxt router type causes excessive stack depth
  await navigateTo(link.to)

  const hash = link.to.hash!
  const observer = new MutationObserver(() => {
    if (scrollToHash(hash)) observer.disconnect()
  })
  observer.observe(document.body, { childList: true, subtree: true })
  setTimeout(() => observer.disconnect(), 2000)
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.header-root {
  position: relative;
  z-index: var(--z-header);
  height: var(--header-height);
  padding-block: 0;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);

  :deep(.container) {
    height: 100%;
  }
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 100%;
}

.logo-link {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  height: 36px;
  min-width: 80px;
  text-decoration: none;
}

.logo {
  height: 36px;
  width: auto;
  max-width: 160px;
  object-fit: contain;
}

.logo-fallback {
  @include text-body(700);
  color: var(--color-text);
  flex-shrink: 0;
}

.nav {
  display: none;
  justify-content: center;
  gap: 24px;
  flex: 1;

  @include lg { display: flex; }
}

.nav-link {
  @include text-body-sm(500);
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color 0.15s;

  &:hover { color: var(--color-text); }
  &--active { color: var(--color-text); font-weight: 600; }
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

  @include lg { display: flex; }
}

.venue-hours {
  @include text-xs;
  color: var(--color-text-secondary);
}

.venue-phone {
  @include text-caption(600);
  color: var(--color-text);
  text-decoration: none;
}

.branch-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  @include text-caption(500);
  cursor: pointer;
  flex-shrink: 0;
  max-width: 200px;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: var(--primary-subtle);
    border-color: var(--primary);
  }
}

.pill-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;

  @include lg {
    max-width: 180px;
  }
}


// ─── Mobile menu ─────────────────────────────────────────────────────────────

.mm-nav {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.mm-nav-link {
  @include text-body(600);
  color: var(--color-text);
  text-decoration: none;
  padding: 14px 0;
  transition: color 0.15s;

  &:hover { color: var(--primary); }

  &--active { color: var(--primary); }
}

// ─── Footer ──────────────────────────────────────────────────────────────────

.mm-footer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 24px;
  border-top: 1px solid var(--color-border);
}

.mm-venue {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mm-venue-phone {
  @include text-body-sm(600);
  color: var(--color-text);
  text-decoration: none;
}

.mm-venue-hours {
  @include text-xs;
  color: var(--color-text-secondary);
}

</style>
