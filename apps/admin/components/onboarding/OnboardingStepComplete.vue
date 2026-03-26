<template>
  <div class="step-complete-root">
    <div class="celebration">
      <span class="big-emoji">🎉</span>
      <UiTitle size="h3">Всё готово!</UiTitle>
      <UiText size="medium" class="subtitle">
        Основные настройки выполнены. Можно начинать работу.
      </UiText>
    </div>

    <div class="recommendations">
      <UiText size="small" class="rec-title">Что настроить дальше:</UiText>

      <div class="rec-list">
        <div
          v-for="rec in recommendations"
          :key="rec.path"
          class="rec-item"
        >
          <UiIcon :name="rec.icon" :size="20" class="rec-icon" />
          <div class="rec-body">
            <UiText size="small" class="rec-label">{{ rec.label }}</UiText>
            <UiText size="tiny" class="rec-hint">{{ rec.hint }}</UiText>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiTitle, UiText, UiIcon } from '@fastio/ui'
import type { IconName } from '@fastio/icons'

const recommendations: { icon: IconName; label: string; path: string; hint: string }[] = [
  {
    icon: 'settings',
    label: 'Рабочие часы',
    path: '/settings/contacts',
    hint: 'Нужны для корректного бронирования',
  },
  {
    icon: 'dishes',
    label: 'Меню',
    path: '/content/menu',
    hint: 'Добавьте категории и товары',
  },
  {
    icon: 'layoutGrid',
    label: 'Логотип',
    path: '/appearance/theme',
    hint: 'Загрузите лого вашего заведения',
  },
  {
    icon: 'fileText',
    label: 'Контент сайта',
    path: '/content',
    hint: 'Настройте тексты и изображения',
  },
]
</script>

<style scoped lang="scss">
.step-complete-root {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.celebration {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.big-emoji {
  font-size: 48px;
  line-height: 1;
}

.subtitle {
  color: var(--color-text-secondary);
}

.rec-title {
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 8px;
  display: block;
}

.rec-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rec-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  text-decoration: none;
  color: var(--color-text);
  transition: background 0.15s;
  cursor: default;

  &:hover {
    background: var(--color-bg-hover);
  }
}

.rec-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

.rec-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.rec-label {
  font-weight: 500;
}

.rec-hint {
  color: var(--color-text-secondary);
}
</style>
