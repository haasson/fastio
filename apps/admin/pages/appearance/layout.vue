<template>
  <div class="layout-root">
    <div class="columns">

      <!-- Главная -->
      <div class="col">
        <h3 class="col-title">Главная</h3>
        <UiSelect
          :value="null"
          :options="availableForHome"
          placeholder="Добавить секцию..."
          @update:value="addToHome"
        />
        <div class="section-list">
          <div class="section-item section-item--locked">
            <span class="lock-gap" />
            <span class="item-label">Шапка</span>
          </div>
          <VueDraggable
            v-model="homeOrder"
            handle=".drag-handle"
            :animation="200"
            class="draggable"
          >
            <div v-for="key in homeOrder" :key="key" class="section-item">
              <span class="drag-handle">
                <UiIcon name="grip" :size="14" />
              </span>
              <span class="item-label">{{ featureLabel(key) }}</span>
              <UiButton
                type="text"
                size="small"
                icon="close"
                @click="removeFromHome(key)"
              />
            </div>
          </VueDraggable>
          <p v-if="homeOrder.length === 0" class="empty-hint">Добавьте секции для главной страницы</p>
          <div class="section-item section-item--locked">
            <span class="lock-gap" />
            <span class="item-label">Футер</span>
          </div>
        </div>
      </div>

      <!-- Страницы -->
      <div class="col">
        <h3 class="col-title">Страницы</h3>
        <UiSelect
          :value="null"
          :options="availableForPages"
          placeholder="Добавить страницу..."
          @update:value="addToPages"
        />
        <div v-if="pagesOrder.length > 0" class="section-list">
          <div v-for="key in pagesOrder" :key="key" class="section-item">
            <span class="item-label">{{ featureLabel(key) }}</span>
            <UiButton
              type="text"
              size="small"
              icon="close"
              @click="removeFromPages(key)"
            />
          </div>
        </div>
        <p v-else class="empty-hint">Выберите секции для отдельных страниц</p>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { UiSelect, UiIcon, UiButton } from '@fastio/ui'
import { SECTION_KEYS, featureLabel, PAGE_KEYS, type SectionKey, type NavPageKey } from '@fastio/shared'
import { AppearanceFormKey } from '~/composables/data/useAppearanceForm'

const form = inject(AppearanceFormKey)!
const siteLayoutForm = form.siteLayoutForm

const homeOrder = computed({
  get: () => siteLayoutForm.sectionsOrder,
  set: (val: string[]) => { siteLayoutForm.sectionsOrder = val as SectionKey[] },
})

const pagesOrder = computed({
  get: () => siteLayoutForm.pages ?? [],
  set: (val: string[]) => { siteLayoutForm.pages = val as NavPageKey[] },
})

const availableForHome = computed(() => SECTION_KEYS
  .filter((k) => !homeOrder.value.includes(k))
  .map((k) => ({ value: k, label: featureLabel(k) })),
)

const availableForPages = computed(() => PAGE_KEYS
  .filter((k) => !pagesOrder.value.includes(k as NavPageKey))
  .map((k) => ({ value: k, label: featureLabel(k) })),
)

const addToHome = (key: string | number | (string | number)[] | null) => {
  if (!key || typeof key !== 'string' || homeOrder.value.includes(key as SectionKey)) return
  siteLayoutForm.sectionsOrder = [...siteLayoutForm.sectionsOrder, key as SectionKey]
}

const addToPages = (key: string | number | (string | number)[] | null) => {
  if (!key || typeof key !== 'string' || pagesOrder.value.includes(key as NavPageKey)) return
  siteLayoutForm.pages = [...(siteLayoutForm.pages ?? []), key as NavPageKey]
}

const removeFromHome = (key: string) => {
  siteLayoutForm.sectionsOrder = siteLayoutForm.sectionsOrder.filter((k) => k !== key)
}

const removeFromPages = (key: string) => {
  siteLayoutForm.pages = (siteLayoutForm.pages ?? []).filter((k) => k !== key)
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.layout-root {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.columns {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;

  @include mq-m {
    grid-template-columns: 1fr 1fr;
  }
}

.col {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.col-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
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

.section-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--color-bg);
  border-top: 1px solid var(--color-border);

  &--locked {
    background: var(--color-surface);

    .item-label {
      color: var(--color-text-tertiary);
    }
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

.empty-hint {
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin: 0;
  padding: 10px 12px;
  border-top: 1px solid var(--color-border);
}
</style>
