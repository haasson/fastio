<template>
  <!-- Меню -->
  <div v-if="pageKey === 'menu'" class="field">
    <label class="field-label">Вид по умолчанию</label>
    <UiSegmentedControl
      v-model="siteLayoutForm.pageSettings.menu.defaultView"
      :items="menuViewOptions"
      size="small"
    />
  </div>

  <!-- Доставка -->
  <div v-else-if="pageKey === 'delivery'" class="fields-wrap">
    <div class="field">
      <UiCheckbox v-model:checked="siteLayoutForm.pageSettings.delivery.showMap">
        Показывать карту с зонами доставки
      </UiCheckbox>
    </div>
    <div class="field">
      <label class="field-label">Описание доставки</label>
      <UiSegmentedControl
        v-model="siteLayoutForm.pageSettings.delivery.descriptionMode"
        :items="deliveryDescriptionOptions"
        size="small"
      />
    </div>
    <div v-if="siteLayoutForm.pageSettings.delivery.descriptionMode === 'manual'" class="field">
      <RichTextEditor
        v-model="contentForm.delivery.manualText"
        label="Текст описания"
      />
    </div>
    <span v-else class="hint">
      Описание будет сформировано автоматически из настроек доставки
    </span>
  </div>

  <!-- О нас -->
  <div v-else-if="pageKey === 'about'" class="fields-wrap">
    <div class="field">
      <label class="field-label">Заглавное фото</label>
      <div class="cover-wrap">
        <ImageUploadTrigger
          :model-value="contentForm.about.coverUrl"
          aspect-ratio="16:9"
          modal-title="Заглавное фото страницы «О нас»"
          @pending="emit('pending-about-cover', $event)"
        />
      </div>
    </div>
    <div class="field">
      <RichTextEditor
        v-model="contentForm.about.text"
        label="Текст страницы"
      />
    </div>
  </div>

  <GalleryPicker
    v-else-if="pageKey === 'gallery'"
    :gallery-ids="siteLayoutForm.pageSettings.gallery?.galleryIds ?? []"
    @update:gallery-ids="siteLayoutForm.pageSettings.gallery = { galleryIds: $event }"
  />
  <span v-else-if="pageKey === 'vacancies'" class="coming-soon">Настройки страницы вакансий появятся в ближайшее время</span>
  <span v-else-if="pageKey === 'booking'" class="hint">
    Настройки бронирования — в разделе <NuxtLink to="/reservations/settings" class="link">Бронирования → Настройки</NuxtLink>
  </span>
</template>

<script setup lang="ts">
import { UiSegmentedControl, UiCheckbox } from '@fastio/ui'
import RichTextEditor from '~/components/ui/RichTextEditor.vue'
import ImageUploadTrigger from '~/components/ui/ImageUploadTrigger.vue'
import GalleryPicker from './GalleryPicker.vue'
import type { SiteLayout, SiteContent, PageKey } from '@fastio/shared'

defineProps<{
  pageKey: PageKey
  siteLayoutForm: SiteLayout
  contentForm: SiteContent
}>()

const emit = defineEmits<{
  'pending-about-cover': [file: File | null]
}>()

const menuViewOptions = [
  { value: 'categories', label: 'Категории' },
  { value: 'dishes', label: 'Блюда' },
]

const deliveryDescriptionOptions = [
  { value: 'auto', label: 'Авто' },
  { value: 'manual', label: 'Свой текст' },
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

.hint {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.cover-wrap {
  max-width: 200px;
}

.link {
  color: var(--color-primary);
  text-decoration: none;

  &:hover { text-decoration: underline; }
}

.coming-soon {
  font-size: 13px;
  color: var(--color-text-tertiary);
}
</style>
