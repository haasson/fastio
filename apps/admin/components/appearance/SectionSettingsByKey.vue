<template>
  <div v-if="sectionKey === 'categoryBar'" class="field">
    <label class="field-label">Поведение при переполнении</label>
    <UiSegmentedControl
      v-model="form.sections.categoryBar.overflow"
      :items="categoryBarOverflowOptions"
      size="small"
    />
  </div>

  <HeroOptions
    v-else-if="sectionKey === 'hero'"
    v-model="form.sections.hero"
    :hero-content="contentForm.hero"
    :on-pending-hero-bg="pendingHeroBg"
  />

  <div v-else-if="sectionKey === 'banners'" class="fields-wrap">
    <span class="banners-hint">Баннеры управляются в разделе <RouterLink to="/content/banners" class="banners-link">Контент → Баннеры</RouterLink></span>
    <div class="field">
      <label class="field-label">Размер баннера</label>
      <UiSegmentedControl
        v-model="form.sections.banners.displayMode"
        :items="bannerDisplayOptions"
        size="small"
      />
    </div>
    <div class="field">
      <UiCheckbox v-model:checked="form.sections.banners.autoplay">Автоперелистывание</UiCheckbox>
    </div>
    <div v-if="form.sections.banners.autoplay" class="field">
      <label class="field-label">Интервал (сек)</label>
      <UiInputNumber
        v-model:value="form.sections.banners.autoplayInterval"
        :min="1"
        :max="30"
        :step="1"
        :show-button="true"
        style="width: 100px"
      />
    </div>
  </div>

  <div v-else-if="sectionKey === 'menu'" class="fields-wrap">
    <div class="field">
      <label class="field-label">Вид по умолчанию</label>
      <UiSegmentedControl
        v-model="form.sections.menu.defaultView"
        :items="menuViewOptions"
        size="small"
      />
    </div>
    <div class="field">
      <label class="field-label">Описание блюда</label>
      <UiSegmentedControl
        v-model="form.sections.menu.dishDescriptionMode"
        :items="dishDescriptionOptions"
        size="small"
      />
    </div>
    <div class="field">
      <label class="field-label">Карточка на мобильном</label>
      <UiSegmentedControl
        v-model="form.sections.menu.mobileDishCard"
        :items="mobileDishCardOptions"
        size="small"
      />
    </div>
  </div>

  <GalleryPicker
    v-else-if="sectionKey === 'gallery'"
    :gallery-ids="form.sections.gallery.galleryIds ?? []"
    @update:gallery-ids="form.sections.gallery.galleryIds = $event"
  />

  <span v-else-if="sectionKey === 'reviews'" class="coming-soon">Управление отзывами появится в ближайшее время</span>

  <span v-else-if="sectionKey === 'delivery'" class="coming-soon">Настройки секции доставки появятся в ближайшее время</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { UiSegmentedControl, UiInputNumber, UiCheckbox } from '@fastio/ui'
import HeroOptions from './HeroOptions.vue'
import GalleryPicker from './GalleryPicker.vue'
import type { SiteLayout, SiteContent, SectionKey } from '@fastio/shared'
import { dishDescriptionOptions, mobileDishCardOptions } from '@fastio/shared'
import { useTenantLabels } from '~/composables/plan/useTenantLabels'

defineProps<{
  sectionKey: SectionKey
  form: SiteLayout
  contentForm: SiteContent
  pendingHeroBg: (file: File | null) => void
}>()

const categoryBarOverflowOptions = [
  { value: 'scroll', label: 'Скролл' },
  { value: 'wrap', label: 'Перенос' },
]

const bannerDisplayOptions = [
  { value: 'single', label: 'Один на экране' },
  { value: 'auto', label: 'По размеру' },
]

const { itemsLabel } = useTenantLabels()
const menuViewOptions = computed(() => [
  { value: 'categories', label: 'Категории' },
  { value: 'dishes', label: itemsLabel.value },
])

</script>

<style scoped lang="scss">
.fields-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.field-label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-hint);
}

.coming-soon {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

.banners-hint {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

.banners-link {
  color: var(--color-primary);
  text-decoration: none;

  &:hover { text-decoration: underline; }
}
</style>
