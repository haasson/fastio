<template>
  <div class="header-options-root">
    <div class="field">
      <label class="label">Логотип</label>
      <div class="logo-wrap">
        <ImageUploadTrigger
          :model-value="form.contentForm.logo"
          aspect-ratio="free"
          modal-title="Логотип"
          @update:model-value="onLogoChange"
          @pending="form.setPendingLogo"
        />
      </div>
    </div>

    <div class="nav-section">
      <label class="label">Навигация</label>

      <VueDraggable
        v-if="navItems.length"
        v-model="navItems"
        handle=".drag-handle"
        :animation="200"
        class="nav-list"
      >
        <div v-for="item in navItems" :key="item.key" class="nav-item">
          <UiIcon name="grip" :size="12" class="drag-handle" />
          <span class="nav-item-label">{{ featureLabel(item.key) }}</span>
          <UiSelect
            v-if="isDualFeature(item.key)"
            :value="item.action"
            :options="actionOptions"
            size="tiny"
            class="action-select"
            @update:value="updateAction(item.key, $event as 'scroll' | 'navigate')"
          />
          <span v-else class="action-hint">{{ item.action === 'scroll' ? 'скролл к секции' : 'переход на страницу' }}</span>
          <UiIcon
            name="close"
            :size="12"
            class="remove-btn"
            @click="removeNavItem(item.key)"
          />
        </div>
      </VueDraggable>

      <UiSelect
        v-if="availableOptions.length"
        :value="null"
        :options="availableOptions"
        size="small"
        placeholder="Добавить..."
        class="add-select"
        @update:value="addNavItem"
      />
    </div>

    <div class="field">
      <label class="label">Информация</label>
      <div class="row">
        <UiCheckbox v-model="siteLayoutForm.header.showPhone">Телефон</UiCheckbox>
        <UiCheckbox v-model="siteLayoutForm.header.showWorkingHours">Часы работы</UiCheckbox>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { UiCheckbox, UiSelect, UiIcon } from '@fastio/ui'
import ImageUploadTrigger from '~/components/ui/ImageUploadTrigger.vue'
import { featureLabel, SITE_FEATURES, STRUCTURAL_SECTIONS } from '@fastio/shared'
import type { SiteFeatureKey } from '@fastio/shared'
import type { NavItem, SectionKey, NavPageKey } from '@fastio/shared'
import { AppearanceFormKey } from '~/composables/data/useAppearanceForm'

const form = inject(AppearanceFormKey)!
const siteLayoutForm = form.siteLayoutForm

const onLogoChange = (val: string | null) => {
  form.contentForm.logo = val
  if (!val) form.setPendingLogo(null)
}

const actionOptions = [
  { value: 'scroll', label: 'Скролл к секции' },
  { value: 'navigate', label: 'Переход на страницу' },
]

const usedKeys = computed(() => new Set(siteLayoutForm.header.navItems.map((i) => i.key)))

const isNavEligible = (key: string) => (SITE_FEATURES as Record<string, { nav: boolean }>)[key]?.nav === true

/** All available features: active sections/pages that are nav-eligible, deduplicated */
const availableOptions = computed(() => {
  const seen = new Set<string>()
  const options: { value: string; label: string }[] = []

  for (const k of siteLayoutForm.sectionsOrder) {
    if (!isNavEligible(k) || usedKeys.value.has(k)) continue
    seen.add(k)
    options.push({ value: k, label: featureLabel(k) })
  }

  for (const k of (siteLayoutForm.pages ?? [])) {
    if (!isNavEligible(k) || usedKeys.value.has(k) || seen.has(k)) continue
    options.push({ value: k, label: featureLabel(k) })
  }

  return options
})

const isDualFeature = (key: string) => {
  const inSections = siteLayoutForm.sectionsOrder.includes(key as SectionKey)
    && !STRUCTURAL_SECTIONS.includes(key as SectionKey)
  const inPages = (siteLayoutForm.pages ?? []).includes(key as NavPageKey)

  return inSections && inPages
}

const navItems = computed({
  get: () => siteLayoutForm.header.navItems,
  set: (val: NavItem[]) => { siteLayoutForm.header.navItems = val },
})

const addNavItem = (key: string | null) => {
  if (!key) return
  const inSections = siteLayoutForm.sectionsOrder.includes(key as SectionKey)
    && !STRUCTURAL_SECTIONS.includes(key as SectionKey)

  const action: NavItem['action'] = inSections ? 'scroll' : 'navigate'

  siteLayoutForm.header.navItems = [
    ...siteLayoutForm.header.navItems,
    { key, action },
  ]
}

const removeNavItem = (key: string) => {
  siteLayoutForm.header.navItems = siteLayoutForm.header.navItems.filter((i) => i.key !== key)
}

const updateAction = (key: string, action: 'scroll' | 'navigate') => {
  siteLayoutForm.header.navItems = siteLayoutForm.header.navItems.map((i) => i.key === key ? { ...i, action } : i,
  )
}
</script>

<style scoped lang="scss">
.header-options-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.add-select {
  max-width: 200px;
}

.nav-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--color-bg);

  & + & {
    border-top: 1px solid var(--color-border);
  }
}

.drag-handle {
  color: var(--color-text-tertiary);
  cursor: grab;
  flex-shrink: 0;

  &:active {
    cursor: grabbing;
  }
}

.nav-item-label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-select {
  width: 180px;
  flex-shrink: 0;
}

.action-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.remove-btn {
  color: var(--color-text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s;

  &:hover {
    color: var(--color-text);
  }
}
</style>
