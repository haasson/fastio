<template>
  <SectionSettingsRow v-if="sectionKey === 'categoryBar'" :label="featureLabel(sectionKey)">
    <div class="field">
      <label class="field-label">Поведение при переполнении</label>
      <UiSegmentedControl
        v-model="form.sections.categoryBar.overflow"
        :items="categoryBarOverflowOptions"
        size="small"
      />
    </div>
  </SectionSettingsRow>

  <SectionSettingsRow v-else-if="sectionKey === 'hero'" :label="featureLabel(sectionKey)">
    <HeroOptions v-model="form.sections.hero" :hero-content="contentForm.hero" :on-pending-hero-bg="pendingHeroBg" />
  </SectionSettingsRow>

  <SectionSettingsRow v-else-if="sectionKey === 'banners'" :label="featureLabel(sectionKey)">
    <div class="fields-wrap">
      <ImageListManager
        v-model="contentForm.banners"
        @pending="pendingBanners"
      />
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
  </SectionSettingsRow>

  <SectionSettingsRow v-else-if="sectionKey === 'menu'" :label="featureLabel(sectionKey)">
    <div class="field">
      <label class="field-label">Вид по умолчанию</label>
      <UiSegmentedControl
        v-model="form.sections.menu.defaultView"
        :items="menuViewOptions"
        size="small"
      />
    </div>
  </SectionSettingsRow>

  <SectionSettingsRow v-else-if="sectionKey === 'gallery'" :label="featureLabel(sectionKey)">
    <span class="coming-soon">Управление галереей появится в ближайшее время</span>
  </SectionSettingsRow>

  <SectionSettingsRow v-else-if="sectionKey === 'reviews'" :label="featureLabel(sectionKey)">
    <span class="coming-soon">Управление отзывами появится в ближайшее время</span>
  </SectionSettingsRow>

  <SectionSettingsRow v-else-if="sectionKey === 'delivery'" :label="featureLabel(sectionKey)">
    <span class="coming-soon">Настройки секции доставки появятся в ближайшее время</span>
  </SectionSettingsRow>

  <SectionSettingsRow v-else-if="sectionKey === 'vacancies'" :label="featureLabel(sectionKey)">
    <span class="coming-soon">Настройки секции вакансий появятся в ближайшее время</span>
  </SectionSettingsRow>
</template>

<script setup lang="ts">
import { UiSegmentedControl, UiInputNumber, UiCheckbox } from '@fastio/ui'
import SectionSettingsRow from './SectionSettingsRow.vue'
import HeroOptions from './HeroOptions.vue'
import ImageListManager from '~/components/ui/ImageListManager.vue'
import { featureLabel } from '@fastio/shared'
import type { SiteLayout, SiteContent, SectionKey } from '@fastio/shared'

defineProps<{
  sectionKey: SectionKey
  form: SiteLayout
  contentForm: SiteContent
  pendingHeroBg: (file: File | null) => void
  pendingBanners: (files: { blobUrl: string; file: File }[]) => void
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
</style>
