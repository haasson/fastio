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

      <div v-for="key in structuralOrder" :key="key" class="section-group">
        <div
          class="section-item section-item--locked"
          :class="{ 'section-item--expanded': openKeys.has(key) }"
          @click="toggle(key)"
        >
          <span class="lock-gap" />
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
import { computed, inject, onMounted, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from '#imports'
import { VueDraggable } from 'vue-draggable-plus'
import { UiIcon, UiSectionHeader } from '@fastio/ui'
import SectionSettingsByKey from '~/components/appearance/SectionSettingsByKey.vue'
import HeaderOptions from '~/components/appearance/HeaderOptions.vue'
import { SECTION_KEYS, STRUCTURAL_SECTIONS, featureLabel, isFeatureAvailable, type SectionKey, type NavPageKey } from '@fastio/shared'
import { useConfirm } from '@fastio/kit'
import { AppearanceFormKey } from '~/composables/data/useAppearanceForm'
import { useTenantStore } from '~/stores/tenant'
import { useGate } from '~/composables/plan/useGate'

const form = inject(AppearanceFormKey)!
const siteLayoutForm = form.siteLayoutForm
const { confirm } = useConfirm()
const tenantStore = useTenantStore()
const { businessType } = storeToRefs(tenantStore)
const gate = useGate()

const isAvailable = (key: string) => {
  if (key === 'delivery') return gate.delivery.value.enabled
  if (key === 'booking') return gate.reservations.value.enabled

  return isFeatureAvailable(key, tenantStore.tenant.modules, businessType.value)
}

const route = useRoute()
const headerOpen = ref(false)
const openKeys = reactive(new Set<string>())

onMounted(() => {
  if (route.query.open === 'header') headerOpen.value = true
})

const toggle = (key: string) => {
  if (openKeys.has(key)) openKeys.delete(key)
  else openKeys.add(key)
}

// Структурные секции — фиксированная позиция, не драгаются
const structuralOrder = computed(() => STRUCTURAL_SECTIONS.filter(
  (k) => isAvailable(k) && siteLayoutForm.sectionsOrder.includes(k as SectionKey),
),
)

const order = computed({
  get: () => siteLayoutForm.sectionsOrder.filter(
    (k) => isAvailable(k) && !STRUCTURAL_SECTIONS.includes(k as SectionKey),
  ),
  set: (val: string[]) => {
    // Вставляем недоступные не-структурные ключи на их оригинальные позиции,
    // чтобы при включении модуля секция не уехала в конец
    const all = siteLayoutForm.sectionsOrder
    const hidden = all.filter((k) => !isAvailable(k) && !STRUCTURAL_SECTIONS.includes(k as SectionKey))
    const result = [...val] as SectionKey[]

    for (const key of hidden) {
      const origIdx = all.indexOf(key)

      result.splice(Math.min(origIdx, result.length), 0, key)
    }

    // Структурные секции всегда идут первыми в своём порядке
    const structural = all.filter((k) => STRUCTURAL_SECTIONS.includes(k as SectionKey))

    siteLayoutForm.sectionsOrder = [...structural, ...result]
  },
})

// setter пустой — VueDraggable вызывает его при drag, но реальное обновление идёт через order
const disabledKeys = computed({
  get: () => SECTION_KEYS.filter((k) => isAvailable(k) && !siteLayoutForm.sectionsOrder.includes(k as SectionKey)),
  set: () => {},
})

const addSection = (key: string) => {
  if (siteLayoutForm.sectionsOrder.includes(key as SectionKey)) return

  const section = siteLayoutForm.sections[key as SectionKey] as { enabled: boolean } | undefined

  if (section) section.enabled = true

  if (STRUCTURAL_SECTIONS.includes(key as SectionKey)) {
    // Структурные секции всегда первые, в порядке определённом STRUCTURAL_SECTIONS
    const nonStructural = siteLayoutForm.sectionsOrder.filter((k) => !STRUCTURAL_SECTIONS.includes(k as SectionKey))
    const structural = [...siteLayoutForm.sectionsOrder.filter((k) => STRUCTURAL_SECTIONS.includes(k as SectionKey)), key as SectionKey]
      .sort((a, b) => STRUCTURAL_SECTIONS.indexOf(a as SectionKey) - STRUCTURAL_SECTIONS.indexOf(b as SectionKey))

    siteLayoutForm.sectionsOrder = [...structural, ...nonStructural]
  } else {
    siteLayoutForm.sectionsOrder = [...siteLayoutForm.sectionsOrder, key as SectionKey]
  }
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
@use '@fastio/styles/mixins/layout' as *;
@use '@fastio/styles/mixins/accordion' as *;

.sections-root {
  @include flex-col;
}

.mt {
  margin-top: var(--space-16);
}

.section-list {
  @include accordion-list;
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
  @include accordion-item;

  &--footer {
    cursor: default;
  }
}

.section-list > .section-item:first-child {
  border-top: none;
}

.lock-gap {
  width: 14px;
  flex-shrink: 0;
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
  border-top: 1px solid var(--color-border);
}
</style>
