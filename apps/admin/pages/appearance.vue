<template>
  <div class="appearance-root">
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

    <ConfigIssuesModal
      :issues="configIssues"
      @close="dismissConfigIssues()"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue'
import { storeToRefs } from 'pinia'
import { UiButton } from '@fastio/ui'
import AppearancePreview from '~/features/appearance/components/AppearancePreview.vue'
import ConfigIssuesModal from '~/features/appearance/components/ConfigIssuesModal.vue'
import { useTenantStore } from '~/shared/stores/tenant'
import { useAppearanceForm, AppearanceFormKey } from '~/features/appearance'
import { useUnsavedGuard } from '~/shared/ui/composables/useUnsavedGuard'
import TabsLayout from '~/shared/ui/components/TabsLayout.vue'
import { usePageTitle } from '~/shared/composables/usePageTitle'
import type { SiteLayout } from '@fastio/shared'

usePageTitle('Оформление')

const tabs = [
  { value: 'sections', label: 'Секции', icon: 'image' as const },
  { value: 'pages', label: 'Страницы', icon: 'fileText' as const },
  { value: 'theme', label: 'Оформление', icon: 'palette' as const },
  { value: 'seo', label: 'SEO', icon: 'search' as const },
]

const tenantStore = useTenantStore()

const { tenant } = storeToRefs(tenantStore)
const form = useAppearanceForm(tenant)
const { isDirty, saving, configIssues, dismissConfigIssues } = form

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
