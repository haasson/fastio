<template>
  <!-- Меню -->
  <div v-if="pageKey === 'menu'" class="fields-wrap">
    <UiAlert v-if="siteLayoutForm.sections.menu.enabled" type="warning" size="small">
      Меню уже показывается секцией на главной — отдельная страница продублирует полный каталог.
      Чтобы оставить меню только страницей, отключите секцию «Меню» во вкладке «Секции».
    </UiAlert>
    <div class="field">
      <label class="field-label">Вид по умолчанию</label>
      <UiSegmentedControl
        v-model="siteLayoutForm.pageSettings.menu.defaultView"
        :items="menuViewOptions"
        size="small"
      />
    </div>
    <div class="field">
      <label class="field-label">Описание блюда</label>
      <UiSegmentedControl
        v-model="siteLayoutForm.pageSettings.menu.dishDescriptionMode"
        :items="dishDescriptionOptions"
        size="small"
      />
    </div>
    <div class="field">
      <label class="field-label">Карточка на мобильном</label>
      <UiSegmentedControl
        v-model="siteLayoutForm.pageSettings.menu.mobileDishCard"
        :items="mobileDishCardOptions"
        size="small"
      />
    </div>
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
  <!-- TODO: vacancies settings — скрыто до реализации функционала -->
  <!-- <span v-else-if="pageKey === 'vacancies'" class="coming-soon">Настройки страницы вакансий появятся в ближайшее время</span> -->
  <span v-else-if="pageKey === 'booking'" class="hint">
    Настройки бронирования — в разделе <NuxtLink to="/reservations/settings" class="link">Бронирования → Настройки</NuxtLink>
  </span>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { UiSegmentedControl, UiCheckbox, UiAlert } from '@fastio/ui'
import ImageUploadTrigger from '~/shared/ui/components/ImageUploadTrigger.vue'

// RichTextEditor тянет tiptap (~366 kB). Грузим лениво — редактор показывается
// только для вкладок about/delivery страницы appearance.
const RichTextEditor = defineAsyncComponent(
  () => import('~/shared/ui/components/RichTextEditor.vue'),
)

import GalleryPicker from './GalleryPicker.vue'
import type { SiteLayout, SiteContent, PageKey, NavPageKey } from '@fastio/shared'
import { dishDescriptionOptions, mobileDishCardOptions } from '@fastio/shared'
import { useTerms } from '~/features/legal'

defineProps<{
  pageKey: PageKey | NavPageKey
  siteLayoutForm: SiteLayout
  contentForm: SiteContent
}>()

const emit = defineEmits<{
  'pending-about-cover': [file: File | null]
}>()

const { item } = useTerms()
const menuViewOptions = computed(() => [
  { value: 'categories', label: 'Категории' },
  { value: 'dishes', label: item.plural.label },
])

const deliveryDescriptionOptions = [
  { value: 'auto', label: 'Авто' },
  { value: 'manual', label: 'Свой текст' },
]
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

.hint {
  font-size: var(--font-size-base);
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
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}
</style>
