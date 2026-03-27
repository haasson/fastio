<template>
  <div class="step-type-root">
    <UiTitle size="h3">Добро пожаловать в Fastio!</UiTitle>
    <UiText size="small" class="hint">
      Давайте настроим ваш аккаунт за пару минут. Для начала выберите тип бизнеса —
      это поможет нам подготовить интерфейс, подходящий именно вам.
      Выбор всегда можно изменить позже в настройках.
    </UiText>

    <div class="options">
      <button
        v-for="option in options"
        :key="option.type"
        class="option"
        :class="{ selected: modelValue === option.type }"
        @click="$emit('update:modelValue', option.type)"
      >
        <UiIcon :name="option.icon" :size="28" class="option-icon" />
        <div class="option-body">
          <UiText size="medium" class="option-title">{{ option.title }}</UiText>
          <UiText size="small" class="option-desc">{{ option.desc }}</UiText>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiTitle, UiText, UiIcon } from '@fastio/ui'
import type { IconName } from '@fastio/icons'
import type { BusinessType } from '@fastio/shared'

defineProps<{ modelValue: BusinessType | null }>()
defineEmits<{ 'update:modelValue': [value: BusinessType] }>()

const options: { type: BusinessType; icon: IconName; title: string; desc: string }[] = [
  {
    type: 'food',
    icon: 'dishes',
    title: 'Общепит',
    desc: 'Кафе, ресторан, столовая, доставка еды',
  },
  // retail temporarily hidden — UI not adapted yet
  // { type: 'retail', icon: 'cart', title: 'Магазин', desc: 'Интернет-магазин, розница, товары на заказ' },
  {
    type: 'services',
    icon: 'users',
    title: 'Услуги',
    desc: 'Красота, образование, ремонт, любые сервисы',
  },
]
</script>

<style scoped lang="scss">
.step-type-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hint {
  color: var(--color-text-secondary);
}

.options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1.5px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-card);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    border-color: var(--color-primary);
    background: var(--color-bg-hover);
  }

  &.selected {
    border-color: var(--color-primary);
    background: var(--color-bg-hover);
  }
}

.option-icon {
  flex-shrink: 0;
  color: var(--color-primary);
}

.option-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-title {
  font-weight: 600;
  color: var(--color-text);
}

.option-desc {
  color: var(--color-text-secondary);
}
</style>
