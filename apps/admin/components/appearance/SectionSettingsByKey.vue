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
    <span class="banners-hint">Баннеры управляются в разделе <RouterLink to="/promotions" class="banners-link">Акции → Баннеры</RouterLink></span>
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
        style="width: 100px"
      />
    </div>
  </div>

  <div v-else-if="sectionKey === 'menu'" class="field">
    <label class="field-label">Вид по умолчанию</label>
    <UiSegmentedControl
      v-model="form.sections.menu.defaultView"
      :items="menuViewOptions"
      size="small"
    />
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
import { RouterLink } from 'vue-router'
import { UiSegmentedControl, UiInputNumber, UiCheckbox } from '@fastio/ui'
import HeroOptions from './HeroOptions.vue'
import GalleryPicker from './GalleryPicker.vue'
import type { SiteLayout, SiteContent, SectionKey } from '@fastio/shared'

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

const menuViewOptions = [
  { value: 'categories', label: 'Категории' },
  { value: 'dishes', label: 'Блюда' },
]
</script>

<style scoped lang="scss">
.fields-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-hint);
}

.coming-soon {
  font-size: 13px;
  color: var(--color-text-tertiary);
}

.banners-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.banners-link {
  color: var(--color-primary);
  text-decoration: none;

  &:hover { text-decoration: underline; }
}
</style>
