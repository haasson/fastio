<template>
  <div class="pages-root">

    <UiSectionHeader title="Активные страницы" />

    <VueDraggable
      v-model="order"
      group="pages"
      handle=".drag-handle"
      :animation="200"
      class="page-list"
    >
      <div v-for="key in order" :key="key" class="page-group">
        <div
          class="page-item"
          :class="{ 'page-item--expanded': openKeys.has(key) }"
          @click="toggle(key)"
        >
          <span class="drag-handle" @click.stop>
            <UiIcon name="grip" :size="14" />
          </span>
          <span class="item-label">{{ featureLabel(key, businessType) }}</span>
          <UiIcon
            name="chevronRound"
            :size="20"
            class="arrow"
            :class="{ open: openKeys.has(key) }"
          />
          <span class="action-btn" @click.stop="removePage(key)">
            <UiIcon name="close" :size="14" />
          </span>
        </div>
        <div v-if="openKeys.has(key)" class="item-options">
          <PageSettingsByKey
            :page-key="key"
            :site-layout-form="siteLayoutForm"
            :content-form="form.contentForm"
            @pending-about-cover="form.onPendingAboutCover"
          />
        </div>
      </div>
    </VueDraggable>

    <p v-if="order.length === 0" class="empty-hint">Перетащите страницы сюда</p>

    <UiSectionHeader v-if="disabledKeys.length" title="Неактивные страницы" class="mt" />

    <VueDraggable
      v-if="disabledKeys.length"
      v-model="disabledKeys"
      group="pages"
      handle=".drag-handle"
      :animation="200"
      class="page-list"
    >
      <div v-for="key in disabledKeys" :key="key" class="page-item">
        <span class="drag-handle">
          <UiIcon name="grip" :size="14" />
        </span>
        <span class="item-label">{{ featureLabel(key, businessType) }}</span>
        <span class="action-btn" @click.stop="addPage(key)">
          <UiIcon name="plus" :size="14" />
        </span>
      </div>
    </VueDraggable>

  </div>
</template>

<script setup lang="ts">
import { computed, inject, reactive } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { UiIcon, UiSectionHeader } from '@fastio/ui'
import PageSettingsByKey from '~/components/appearance/PageSettingsByKey.vue'
import { PAGE_KEYS, STRUCTURAL_SECTIONS, featureLabel, isFeatureAvailable, type PageKey, type NavPageKey, type SectionKey } from '@fastio/shared'
import { useConfirm } from '@fastio/kit'
import { AppearanceFormKey } from '~/composables/data/useAppearanceForm'
import { useTenantStore } from '~/stores/tenant'

const form = inject(AppearanceFormKey)!
const siteLayoutForm = form.siteLayoutForm
const { confirm } = useConfirm()
const tenantStore = useTenantStore()
const businessType = computed(() => tenantStore.tenant?.businessType)

const isAvailable = (key: string) => !tenantStore.tenant?.modules || isFeatureAvailable(key, tenantStore.tenant.modules, businessType.value)

const openKeys = reactive(new Set<string>())

const toggle = (key: string) => {
  if (openKeys.has(key)) openKeys.delete(key)
  else openKeys.add(key)
}

const order = computed({
  get: () => (siteLayoutForm.pages ?? []).filter((k) => isAvailable(k)),
  set: (val: string[]) => {
    // Вставляем недоступные ключи на их оригинальные позиции,
    // чтобы при включении модуля фича не уехала в конец
    const all = siteLayoutForm.pages ?? []
    const hidden = all.filter((k) => !isAvailable(k))
    const result = [...val] as NavPageKey[]

    for (const key of hidden) {
      const origIdx = all.indexOf(key)

      result.splice(Math.min(origIdx, result.length), 0, key)
    }

    siteLayoutForm.pages = result
  },
})

// setter пустой — VueDraggable вызывает его при drag, но реальное обновление идёт через order
const disabledKeys = computed({
  get: () => PAGE_KEYS.filter((k) => isAvailable(k) && !order.value.includes(k as NavPageKey)),
  set: () => {},
})

const addPage = (key: string) => {
  if (order.value.includes(key as NavPageKey)) return
  siteLayoutForm.pages = [...(siteLayoutForm.pages ?? []), key as NavPageKey]
}

const removePage = async (key: string) => {
  const navItem = siteLayoutForm.header.navItems.find((i) => i.key === key)

  if (navItem) {
    const isAlsoSection = siteLayoutForm.sectionsOrder.includes(key as SectionKey)
      && !STRUCTURAL_SECTIONS.includes(key as SectionKey)

    if (isAlsoSection) {
      siteLayoutForm.header.navItems = siteLayoutForm.header.navItems.map((i) => i.key === key ? { ...i, action: 'scroll' as const } : i,
      )
    } else {
      const ok = await confirm({
        title: 'Убрать страницу?',
        message: `«${featureLabel(key, businessType.value)}» используется в навигации хэдера. При отключении будет удалено из навигации.`,
        confirmText: 'Убрать',
        confirmType: 'warning',
      })

      if (!ok) return
      siteLayoutForm.header.navItems = siteLayoutForm.header.navItems.filter((i) => i.key !== key)
    }
  }

  siteLayoutForm.pages = (siteLayoutForm.pages ?? []).filter((k) => k !== key)
  openKeys.delete(key)
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;
@use '@fastio/styles/mixins/accordion' as *;

.pages-root {
  @include flex-col;
}

.mt {
  margin-top: var(--space-16);
}

.page-list {
  @include accordion-list;
}

.page-group {
  display: flex;
  flex-direction: column;
}

.page-item {
  @include accordion-item;
}

.page-list > .page-group:first-child > .page-item,
.page-list > .page-item:first-child {
  border-top: none;
}

.drag-handle {
  @include accordion-drag-handle;
}

.item-label {
  @include accordion-item-label;
}

.action-btn {
  @include accordion-action-btn;
}

.arrow {
  @include accordion-arrow;
}

.item-options {
  @include accordion-options;
}

.empty-hint {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin: 0;
  padding: var(--space-8) var(--space-12);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
}
</style>
