<template>
  <div class="header-options-root">
    <div class="field">
      <label class="label">Логотип</label>
      <div class="logo-wrap">
        <PhotoUpload
          :model-value="form.contentForm.logo"
          @update:model-value="onLogoChange"
          @pending="form.setPendingLogo"
        />
      </div>
    </div>

    <UiSelect
      v-model:value="selectedPages"
      multiple
      :options="availableOptions"
      label="Навигация"
      placeholder="Выберите секции..."
    />

    <div class="row">
      <UiCheckbox v-model="siteLayoutForm.header.showPhone">Телефон</UiCheckbox>
      <UiCheckbox v-model="siteLayoutForm.header.showWorkingHours">Часы работы</UiCheckbox>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { UiCheckbox, UiSelect } from '@fastio/ui'
import PhotoUpload from '~/components/ui/PhotoUpload.vue'
import { NAV_PAGE_KEYS, featureLabel } from '@fastio/shared'
import type { NavItem } from '@fastio/shared'
import { AppearanceFormKey } from '~/composables/data/useAppearanceForm'

const form = inject(AppearanceFormKey)!
const siteLayoutForm = form.siteLayoutForm

const onLogoChange = (val: string | null) => {
  form.contentForm.logo = val
  if (!val) form.setPendingLogo(null)
}

const availableOptions = computed(() => NAV_PAGE_KEYS.map((k) => ({ value: k, label: featureLabel(k) })))

const selectedPages = computed({
  get: () => siteLayoutForm.header.navItems.map((i) => i.page),
  set: (pages: string[] | null) => {
    siteLayoutForm.header.navItems = (pages ?? []).map((page): NavItem => ({
      page,
      placement: siteLayoutForm.header.navItems.find((i) => i.page === page)?.placement ?? 'page',
    }))
  },
})
</script>

<style scoped lang="scss">
.header-options-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-hint);
}

.logo-wrap {
  max-width: 200px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
</style>
