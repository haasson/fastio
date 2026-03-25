<template>
  <div class="appearance-root">
    <template v-if="tenantStore.tenant">
      <TabsLayout
        :tabs="tabs"
        base-path="/appearance"
        card
        full-height
      >
        <template #extra>
          <UiButton
            type="primary"
            :loading="saving"
            :disabled="!isDirty"
            @click="form.save()"
          >
            Сохранить
          </UiButton>
        </template>
        <template #sidebar>
          <AppearancePreview
            :layout="form.siteLayoutForm as SiteLayout"
            :content="form.contentForm"
            :theme="form.themeForm"
          />
        </template>
      </TabsLayout>
    </template>
    <div v-else class="state-msg">Загрузка…</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, provide } from 'vue'
import { storeToRefs } from 'pinia'
import { UiButton } from '@fastio/ui'
import AppearancePreview from '~/components/appearance/AppearancePreview.vue'
import { useTenantStore } from '~/stores/tenant'
import { useAppearanceForm, AppearanceFormKey } from '~/composables/data/useAppearanceForm'
import { useUnsavedGuard } from '~/composables/ui/useUnsavedGuard'
import TabsLayout from '~/components/ui/TabsLayout.vue'
import type { SiteLayout } from '@fastio/shared'

const tabs = [
  { value: 'sections', label: 'Секции', icon: 'image' as const },
  { value: 'pages', label: 'Страницы', icon: 'fileText' as const },
  { value: 'theme', label: 'Оформление', icon: 'palette' as const },
  { value: 'seo', label: 'SEO', icon: 'search' as const },
]

const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())

const { tenant } = storeToRefs(tenantStore)
const form = useAppearanceForm(tenant)
const { isDirty, saving } = form

provide(AppearanceFormKey, form)
useUnsavedGuard(isDirty)
</script>

<style scoped lang="scss">
.appearance-root {
  height: calc(100dvh - var(--topbar-height) - var(--content-padding) * 2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.page-preview) {
  width: 280px;
  zoom: calc(360 / 280);
}

.state-msg {
  color: var(--color-text-secondary);
}
</style>
