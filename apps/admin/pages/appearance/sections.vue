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
            <span class="item-label">{{ featureLabel(key) }}</span>
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
        <span class="item-label">{{ featureLabel(key) }}</span>
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
import { SECTION_KEYS, featureLabel, type SectionKey } from '@fastio/shared'
import { AppearanceFormKey } from '~/composables/data/useAppearanceForm'

const form = inject(AppearanceFormKey)!
const siteLayoutForm = form.siteLayoutForm

const headerOpen = ref(false)
const openKeys = reactive(new Set<string>())

const toggle = (key: string) => {
  if (openKeys.has(key)) openKeys.delete(key)
  else openKeys.add(key)
}

const order = computed({
  get: () => siteLayoutForm.sectionsOrder,
  set: (val: string[]) => { siteLayoutForm.sectionsOrder = val as SectionKey[] },
})

// setter пустой — VueDraggable вызывает его при drag, но реальное обновление идёт через order
const disabledKeys = computed({
  get: () => SECTION_KEYS.filter((k) => !order.value.includes(k)),
  set: () => {},
})

const addSection = (key: string) => {
  if (order.value.includes(key as SectionKey)) return
  siteLayoutForm.sectionsOrder = [...siteLayoutForm.sectionsOrder, key as SectionKey]
}

const removeSection = (key: string) => {
  siteLayoutForm.sectionsOrder = siteLayoutForm.sectionsOrder.filter((k) => k !== key)
  openKeys.delete(key)
}
</script>

<style scoped lang="scss">
.sections-root {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mt {
  margin-top: 16px;
}

.section-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: 8px;
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
  gap: 8px;
  padding: 10px 12px;
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
  border-top: 1px solid var(--color-border);
}
</style>
