<template>
  <div class="appearance-root">
    <template v-if="tenantStore.tenant">
      <div class="tabs-row">
        <UiTabs :model-value="activeTab" :tabs="tabs" @update:model-value="goToTab" />
        <UiButton
          type="primary"
          :loading="saving"
          :disabled="!isDirty"
          @click="form.save()"
        >
          Сохранить
        </UiButton>
      </div>

      <div class="content-grid">
        <div class="main-col">
          <UiCard size="large">
            <NuxtPage />
          </UiCard>
        </div>

        <div class="preview-col">
          <AppearancePreview :layout="form.siteLayoutForm as SiteLayout" :content="form.contentForm" :theme="form.themeForm" />
        </div>
      </div>
    </template>

    <div v-else class="state-msg">Загрузка…</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, provide } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from '#imports'
import { UiTabs, UiCard, UiButton } from '@fastio/ui'
import AppearancePreview from '~/components/appearance/AppearancePreview.vue'
import { useTenantStore } from '~/stores/tenant'
import { useAppearanceForm, AppearanceFormKey } from '~/composables/data/useAppearanceForm'
import { useUnsavedGuard } from '~/composables/ui/useUnsavedGuard'
import type { SiteLayout } from '@fastio/shared'

// --- static config ---
const tabs = [
  { value: 'sections', label: 'Секции', icon: 'image' as const },
  { value: 'pages', label: 'Страницы', icon: 'fileText' as const },
  { value: 'theme', label: 'Оформление', icon: 'palette' as const },
  { value: 'seo', label: 'SEO', icon: 'search' as const },
]

// --- store & data ---
const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())

const { tenant } = storeToRefs(tenantStore)
const form = useAppearanceForm(tenant)
const { isDirty, saving } = form

provide(AppearanceFormKey, form)

// --- navigation ---
const route = useRoute()
const router = useRouter()

const activeTab = computed(() => {
  if (route.path.endsWith('/theme')) return 'theme'
  if (route.path.endsWith('/pages')) return 'pages'
  if (route.path.endsWith('/seo')) return 'seo'

  return 'sections'
})

const goToTab = (tab: string | number) => {
  router.push(`/appearance/${tab}`)
}

// --- guards ---
useUnsavedGuard(isDirty)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.appearance-root {
  height: calc(100dvh - var(--topbar-height) - var(--content-padding) * 2);
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.tabs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  flex: 1;
  min-height: 0;

  @include mq-l {
    grid-template-columns: 1fr 360px;
  }
}

.main-col {
  min-height: 0;
  display: flex;
  flex-direction: column;

  :deep(.card) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;

    &::after {
      content: '';
      display: block;
      height: 24px;
    }
  }
}

.preview-col {
  overflow-y: auto;
  min-height: 0;

  :deep(.page-preview) {
    width: 280px;
    zoom: calc(360 / 280);
  }
}
</style>
