<template>
  <div class="sections-root">

    <UiSectionHeader title="Активные секции" />

    <div class="section-list">
      <div
        class="section-item section-item--locked"
        :class="{ 'section-item--expanded': headerOpen }"
        @click="headerOpen = !headerOpen"
      >
        <span class="lock-gap" />
        <span class="item-label">Шапка</span>
        <UiIcon
          name="chevronRound"
          :size="20"
          class="arrow"
          :class="{ open: headerOpen }"
        />
      </div>

      <div v-if="headerOpen" class="item-options">
        <HeaderOptions />
      </div>

      <VueDraggable
        v-model="order"
        group="sections"
        handle=".drag-handle"
        :animation="200"
        class="draggable"
      >
        <div v-for="key in order" :key="key" class="section-group">
          <div
            class="section-item"
            :class="{ 'section-item--expanded': openKeys.has(key) }"
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
            <span class="action-btn" @click.stop="removeSection(key)">
              <UiIcon name="close" :size="14" />
            </span>
          </div>
          <div v-if="openKeys.has(key)" class="item-options">
            <SectionSettingsByKey
              :section-key="key"
              :form="siteLayoutForm"
              :content-form="form.contentForm"
              :pending-hero-bg="form.onPendingHeroBg"
            />
          </div>
        </div>
      </VueDraggable>

      <p v-if="order.length === 0" class="empty-hint">Перетащите секции сюда</p>

      <div class="section-item section-item--locked section-item--footer">
        <span class="lock-gap" />
        <span class="item-label">Футер</span>
      </div>
    </div>

    <UiSectionHeader v-if="disabledKeys.length" title="Неактивные секции" class="mt" />

    <VueDraggable
      v-if="disabledKeys.length"
      v-model="disabledKeys"
      group="sections"
      handle=".drag-handle"
      :animation="200"
      class="section-list"
    >
      <div v-for="key in disabledKeys" :key="key" class="section-item">
        <span class="drag-handle">
          <UiIcon name="grip" :size="14" />
        </span>
        <span class="item-label">{{ featureLabel(key, businessType) }}</span>
        <span class="action-btn" @click.stop="addSection(key)">
          <UiIcon name="plus" :size="14" />
        </span>
      </div>
    </VueDraggable>

  </div>
</template>

<script setup lang="ts">
import { computed, inject, reactive, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { UiIcon, UiSectionHeader } from '@fastio/ui'
import SectionSettingsByKey from '~/components/appearance/SectionSettingsByKey.vue'
import HeaderOptions from '~/components/appearance/HeaderOptions.vue'
import { SECTION_KEYS, STRUCTURAL_SECTIONS, featureLabel, isFeatureAvailable, type SectionKey, type NavPageKey } from '@fastio/shared'
import { useConfirm } from '@fastio/kit'
import { AppearanceFormKey } from '~/composables/data/useAppearanceForm'
import { useTenantStore } from '~/stores/tenant'

const form = inject(AppearanceFormKey)!
const siteLayoutForm = form.siteLayoutForm
const { confirm } = useConfirm()
const tenantStore = useTenantStore()
const businessType = computed(() => tenantStore.tenant?.businessType)

const isAvailable = (key: string) => !tenantStore.tenant?.modules || isFeatureAvailable(key, tenantStore.tenant.modules, businessType.value)

const headerOpen = ref(false)
const openKeys = reactive(new Set<string>())

const toggle = (key: string) => {
  if (openKeys.has(key)) openKeys.delete(key)
  else openKeys.add(key)
}

const order = computed({
  get: () => siteLayoutForm.sectionsOrder.filter((k) => isAvailable(k)),
  set: (val: string[]) => {
    // Вставляем недоступные ключи на их оригинальные позиции,
    // чтобы при включении модуля секция не уехала в конец
    const all = siteLayoutForm.sectionsOrder
    const hidden = all.filter((k) => !isAvailable(k))
    const result = [...val] as SectionKey[]

    for (const key of hidden) {
      const origIdx = all.indexOf(key)

      result.splice(Math.min(origIdx, result.length), 0, key)
    }

    siteLayoutForm.sectionsOrder = result
  },
})

// setter пустой — VueDraggable вызывает его при drag, но реальное обновление идёт через order
const disabledKeys = computed({
  get: () => SECTION_KEYS.filter((k) => isAvailable(k) && !order.value.includes(k)),
  set: () => {},
})

const addSection = (key: string) => {
  if (order.value.includes(key as SectionKey)) return
  siteLayoutForm.sectionsOrder = [...siteLayoutForm.sectionsOrder, key as SectionKey]
  const section = siteLayoutForm.sections[key as SectionKey] as { enabled: boolean } | undefined

  if (section) section.enabled = true
}

const removeSection = async (key: string) => {
  const navItem = siteLayoutForm.header.navItems.find((i) => i.key === key)

  if (navItem) {
    const isAlsoPage = (siteLayoutForm.pages ?? []).includes(key as NavPageKey)

    if (isAlsoPage) {
      siteLayoutForm.header.navItems = siteLayoutForm.header.navItems.map((i) => i.key === key ? { ...i, action: 'navigate' as const } : i,
      )
    } else {
      const ok = await confirm({
        title: 'Убрать секцию?',
        message: `«${featureLabel(key, businessType.value)}» используется в навигации хэдера. При отключении будет удалено из навигации.`,
        confirmText: 'Убрать',
        confirmType: 'warning',
      })

      if (!ok) return
      siteLayoutForm.header.navItems = siteLayoutForm.header.navItems.filter((i) => i.key !== key)
    }
  }

  siteLayoutForm.sectionsOrder = siteLayoutForm.sectionsOrder.filter((k) => k !== key)
  const section = siteLayoutForm.sections[key as SectionKey] as { enabled: boolean } | undefined

  if (section) section.enabled = false
  openKeys.delete(key)
}
</script>

<style scoped lang="scss">
.sections-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.mt {
  margin-top: var(--space-16);
}

.section-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  overflow: hidden;
}

.draggable {
  display: flex;
  flex-direction: column;
}

.section-group {
  display: flex;
  flex-direction: column;
}

.section-item {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: var(--space-8) var(--space-12);
  background: var(--color-bg);
  border-top: 1px solid var(--color-border);
  cursor: pointer;
  user-select: none;

  &--locked {
    background: var(--color-surface);
  }

  &--footer {
    cursor: default;
  }

  &--expanded {
    background: var(--color-surface);
  }
}

.section-list > .section-item:first-child,
.section-list > .draggable > .section-group:first-child > .section-item {
  border-top: none;
}

.lock-gap {
  width: 14px;
  flex-shrink: 0;
}

.drag-handle {
  color: var(--color-text-secondary);
  cursor: grab;
  flex-shrink: 0;
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  line-height: 1;
  display: flex;
  align-items: center;

  &:active {
    cursor: grabbing;
  }
}

.item-label {
  flex: 1;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  padding: var(--space-4);
  border-radius: var(--radius-4);
  transition: color 0.15s;

  &:hover {
    color: var(--color-text);
  }
}

.arrow {
  color: var(--color-text-secondary);
  transition: transform 0.2s;
  transform: rotate(-90deg);
  flex-shrink: 0;

  &.open {
    transform: rotate(0deg);
  }
}

.item-options {
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  padding: var(--space-12) var(--space-12) var(--space-12) 36px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.empty-hint {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin: 0;
  padding: var(--space-8) var(--space-12);
  border-top: 1px solid var(--color-border);
}
</style>
