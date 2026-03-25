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
          <span class="item-label">{{ featureLabel(key) }}</span>
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
          <PageSettingsByKey :page-key="key" />
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
        <span class="item-label">{{ featureLabel(key) }}</span>
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
import { PAGE_KEYS, STRUCTURAL_SECTIONS, featureLabel, type PageKey, type NavPageKey, type SectionKey } from '@fastio/shared'
import { useConfirm } from '@fastio/kit'
import { AppearanceFormKey } from '~/composables/data/useAppearanceForm'

const form = inject(AppearanceFormKey)!
const siteLayoutForm = form.siteLayoutForm
const { confirm } = useConfirm()

const openKeys = reactive(new Set<string>())

const toggle = (key: string) => {
  if (openKeys.has(key)) openKeys.delete(key)
  else openKeys.add(key)
}

const order = computed({
  get: () => siteLayoutForm.pages ?? [],
  set: (val: string[]) => { siteLayoutForm.pages = val as NavPageKey[] },
})

// setter пустой — VueDraggable вызывает его при drag, но реальное обновление идёт через order
const disabledKeys = computed({
  get: () => PAGE_KEYS.filter((k) => !order.value.includes(k as NavPageKey)),
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
        message: `«${featureLabel(key)}» используется в навигации хэдера. При отключении будет удалено из навигации.`,
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
.pages-root {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mt {
  margin-top: 16px;
}

.page-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.page-group {
  display: flex;
  flex-direction: column;
}

.page-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--color-bg);
  border-top: 1px solid var(--color-border);
  cursor: pointer;
  user-select: none;

  &--expanded {
    background: var(--color-surface);
  }
}

.page-list > .page-group:first-child > .page-item,
.page-list > .page-item:first-child {
  border-top: none;
}

.drag-handle {
  color: var(--color-text-tertiary);
  cursor: grab;
  flex-shrink: 0;
  line-height: 1;
  display: flex;
  align-items: center;

  &:active {
    cursor: grabbing;
  }
}

.item-label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
  padding: 2px;
  border-radius: 4px;
  transition: color 0.15s;

  &:hover {
    color: var(--color-text);
  }
}

.arrow {
  color: var(--color-text-tertiary);
  transition: transform 0.2s;
  transform: rotate(-90deg);
  flex-shrink: 0;

  &.open {
    transform: rotate(0deg);
  }
}

.item-options {
  padding: 12px 14px 12px 36px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.empty-hint {
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}
</style>
