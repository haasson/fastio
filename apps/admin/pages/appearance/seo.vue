<template>
  <div class="seo-root">
    <UiSectionHeader title="SEO" />

    <!-- Мета-теги -->
    <div class="group">
      <div class="field">
        <div class="field-label">
          <span class="label">Заголовок страницы</span>
          <span class="counter" :class="{ warn: titleLen > 55, over: titleLen > 60 }">{{ titleLen }} / 60</span>
        </div>
        <UiInput
          v-model:value="seoForm.metaTitle"
          message="Отображается в браузере и результатах поиска"
          placeholder="Например: Суши Мастер — заказать суши онлайн"
          :maxlength="80"
        />
      </div>

      <div class="field">
        <div class="field-label">
          <span class="label">Описание</span>
          <span class="counter" :class="{ warn: descLen > 140, over: descLen > 155 }">{{ descLen }} / 155</span>
        </div>
        <UiInput
          v-model:value="seoForm.metaDescription"
          message="Показывается под заголовком в поисковиках"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 5 }"
          placeholder="Коротко о вашем заведении — что заказать, как быстро доставляют, что особенного"
          :maxlength="200"
        />
      </div>
    </div>

    <div class="divider" />

    <!-- OG-картинка -->
    <div class="group">
      <div class="field-label">
        <span class="label">Картинка для соцсетей</span>
      </div>
      <div class="og-upload">
        <ImageUploadTrigger
          :model-value="seoForm.ogImage"
          aspect-ratio="free"
          modal-title="Картинка для соцсетей"
          @update:model-value="seoForm.ogImage = $event"
          @pending="form.setPendingOgImage"
        />
      </div>
      <span class="hint">Показывается когда ссылку на ваш сайт кидают в мессенджер или соцсеть. Рекомендуемый размер: 1200×630</span>
    </div>

    <div class="divider" />

    <!-- Фавиконка -->
    <div class="group">
      <div class="field-label">
        <span class="label">Фавиконка</span>
      </div>
      <div class="favicon-row">
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
        <div class="favicon-info">
          <p class="favicon-desc">Иконка во вкладке браузера и на экране телефона при добавлении сайта на рабочий стол.</p>
          <p class="favicon-desc">Загрузите квадратную картинку PNG или SVG, минимум 64×64px.</p>
        </div>
      </div>
    </div>

    <div class="divider" />

    <!-- Индексация -->
    <div class="group">
      <div class="robots-row">
        <div>
          <div class="label">Индексация поисковиками</div>
          <div class="hint">Разрешить Google и Яндексу находить и показывать ваш сайт</div>
        </div>
        <UiSwitch
          :model-value="seoForm.robots === 'index'"
          @update:model-value="seoForm.robots = $event ? 'index' : 'noindex'"
        />
      </div>
    </div>

    <div class="divider" />

    <!-- Аналитика -->
    <div class="group">
      <div class="label">Аналитика</div>
      <div class="field">
        <div class="field-label">
          <span class="label">Google Analytics</span>
        </div>
        <UiInput
          v-model:value="seoForm.googleAnalyticsId"
          message="Идентификатор Google Analytics 4. Найти можно в настройках GA → Потоки данных"
          placeholder="G-XXXXXXXXXX"
        />
      </div>

      <div class="field">
        <div class="field-label">
          <span class="label">Яндекс.Метрика</span>
        </div>
        <UiInput
          v-model:value="seoForm.yandexMetrikaId"
          message="Номер счётчика Яндекс.Метрики. Найти можно на metrika.yandex.ru в списке счётчиков"
          placeholder="12345678"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { UiInput, UiSwitch, UiSectionHeader } from '@fastio/ui'
import { AppearanceFormKey } from '~/composables/data/useAppearanceForm'
import ImageUploadTrigger from '~/components/ui/ImageUploadTrigger.vue'

const form = inject(AppearanceFormKey)!
const seoForm = form.seoForm

const titleLen = computed(() => seoForm.metaTitle?.length ?? 0)
const descLen = computed(() => seoForm.metaDescription?.length ?? 0)
</script>

<style scoped lang="scss">
.seo-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.group {
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.counter {
  font-size: 12px;
  color: var(--color-text-hint);
  flex-shrink: 0;

  &.warn {
    color: var(--color-warning);
  }

  &.over {
    color: var(--color-error);
  }
}

.hint {
  font-size: 12px;
  color: var(--color-text-hint);
  line-height: 1.4;
}

.divider {
  height: 1px;
  background: var(--color-border);
}

.og-upload {
  max-width: 480px;
}

.favicon-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.favicon-upload {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
}

.favicon-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.favicon-desc {
  font-size: 12px;
  color: var(--color-text-hint);
  line-height: 1.4;
  margin: 0;
}

.robots-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>
