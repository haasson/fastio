<template>
  <div class="seo-root">
    <!-- ── Мета-теги ─────────────────────────────────────── -->
    <UiFormSection title="Мета-теги" :columns="1">
      <div class="field">
        <div class="field-label">
          <span class="label-text">
            Заголовок страницы
            <UiInfoTip content="Отображается в браузере и результатах поиска" />
          </span>
          <span class="counter" :class="{ warn: titleLen > 55, over: titleLen > 60 }">{{ titleLen }} / 60</span>
        </div>
        <UiInput
          v-model:value="seoForm.metaTitle"
          placeholder="Например: Суши Мастер — заказать суши онлайн"
          :maxlength="80"
        />
      </div>

      <div class="field">
        <div class="field-label">
          <span class="label-text">
            Описание
            <UiInfoTip content="Показывается под заголовком в поисковиках" />
          </span>
          <span class="counter" :class="{ warn: descLen > 140, over: descLen > 155 }">{{ descLen }} / 155</span>
        </div>
        <UiInput
          v-model:value="seoForm.metaDescription"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 5 }"
          placeholder="Коротко о вашем заведении — что заказать, как быстро доставляют, что особенного"
          :maxlength="200"
        />
      </div>
    </UiFormSection>

    <!-- ── Картинка для соцсетей ─────────────────────────── -->
    <UiFormSection
      title="Картинка для соцсетей"
      help="Показывается когда ссылку на ваш сайт кидают в мессенджер или соцсеть. Рекомендуемый размер: 1200×630"
      :columns="1"
    >
      <ImageUploadTrigger
        :model-value="seoForm.ogImage"
        aspect-ratio="free"
        modal-title="Картинка для соцсетей"
        @update:model-value="seoForm.ogImage = $event"
        @pending="form.setPendingOgImage"
      />
    </UiFormSection>

    <!-- ── Фавиконка ─────────────────────────────────────── -->
    <UiFormSection
      title="Фавиконка"
      help="Иконка во вкладке браузера и на экране телефона при добавлении сайта на рабочий стол. Загрузите квадратную картинку PNG или SVG, минимум 64×64px."
      :columns="1"
    >
      <div class="favicon-upload">
        <ImageUploadTrigger
          :model-value="seoForm.favicon"
          aspect-ratio="1:1"
          compact
          modal-title="Фавиконка"
          @update:model-value="seoForm.favicon = $event"
          @pending="form.setPendingFavicon"
        />
      </div>
    </UiFormSection>

    <!-- ── Индексация ────────────────────────────────────── -->
    <UiFormSection
      title="Индексация поисковиками"
      help="Разрешить Google и Яндексу находить и показывать ваш сайт"
    >
      <template #header-right>
        <UiSwitch
          :model-value="seoForm.robots === 'index'"
          @update:model-value="seoForm.robots = $event ? 'index' : 'noindex'"
        />
      </template>
    </UiFormSection>

    <!-- ── Аналитика ─────────────────────────────────────── -->
    <UiFormSection title="Аналитика" :columns="2">
      <UiInput
        v-model:value="seoForm.googleAnalyticsId"
        label="Google Analytics"
        placeholder="G-XXXXXXXXXX"
        help="Идентификатор Google Analytics 4. Найти можно в настройках GA → Потоки данных"
      />
      <UiInput
        v-model:value="seoForm.yandexMetrikaId"
        label="Яндекс.Метрика"
        placeholder="12345678"
        help="Номер счётчика Яндекс.Метрики. Найти можно на metrika.yandex.ru в списке счётчиков"
      />
    </UiFormSection>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { UiFormSection, UiInput, UiSwitch, UiInfoTip } from '@fastio/ui'
import { AppearanceFormKey } from '~/features/appearance'
import ImageUploadTrigger from '~/shared/ui/components/ImageUploadTrigger.vue'

const form = inject(AppearanceFormKey)!
const seoForm = form.seoForm

const titleLen = computed(() => seoForm.metaTitle?.length ?? 0)
const descLen = computed(() => seoForm.metaDescription?.length ?? 0)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.seo-root {
  @include flex-col(var(--space-12));
  max-width: 720px;
}

.field {
  @include flex-col(var(--space-8));
}

.field-label {
  @include flex-between;
}

// Лейбл поля + «?» — нормализованный 12px caption, как у полей формы.
.label-text {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.counter {
  font-size: var(--font-size-sm);
  color: var(--color-text-hint);
  flex-shrink: 0;

  &.warn {
    color: var(--color-warning);
  }

  &.over {
    color: var(--color-error);
  }
}

.favicon-upload {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  overflow: hidden;
}
</style>
