<template>
  <div class="appearance-root">
    <template v-if="tenantStore.tenant">
      <UiTabs :model-value="activeTab" :tabs="tabs" @update:model-value="goToTab" />

      <div class="content-grid">
        <div class="main-col">
          <UiCard size="large">
            <NuxtPage />
          </UiCard>
        </div>

        <div class="preview-col">
          <div class="preview-actions">
            <UiButton
              type="primary"
              :loading="saving"
              :disabled="!isDirty"
              @click="form.save()"
            >
              Сохранить
            </UiButton>
          </div>
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
  { value: 'layout', label: 'Лейаут', icon: 'layoutGrid' as const },
  { value: 'sections', label: 'Секции', icon: 'image' as const },
  { value: 'theme', label: 'Оформление', icon: 'palette' as const },
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
  if (route.path.endsWith('/sections')) return 'sections'

  return 'layout'
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
  }
}

.preview-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-self: start;

  :deep(.page-preview) {
    width: 280px;
    zoom: calc(360 / 280);
  }
}

.preview-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
