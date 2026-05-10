<template>
  <div class="step-menu-style-root">
    <UiTitle size="h3">Как вы продаёте?</UiTitle>
    <UiText size="small" class="hint">
      Это настроит термины в интерфейсе. Выбор фиксируется и в дальнейшем не меняется.
    </UiText>

    <div class="options">
      <OnboardingOption
        v-for="option in options"
        :key="option.value"
        :icon="option.icon"
        :title="option.title"
        :desc="option.desc"
        :selected="modelValue === option.value"
        @select="$emit('update:modelValue', option.value)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiTitle, UiText } from '@fastio/ui'
import type { IconName } from '@fastio/icons'
import type { MenuStyle } from '@fastio/shared'
import OnboardingOption from './OnboardingOption.vue'

defineProps<{ modelValue: MenuStyle }>()

defineEmits<{ 'update:modelValue': [value: MenuStyle] }>()

const options: { value: MenuStyle; icon: IconName; title: string; desc: string }[] = [
  {
    value: 'food',
    icon: 'dishes',
    title: 'Ресторан / кафе / еда',
    desc: 'Интерфейс: «Меню», «Блюда», «Категории»',
  },
  {
    value: 'catalog',
    icon: 'cart',
    title: 'Магазин / каталог',
    desc: 'Интерфейс: «Каталог», «Товары», «Разделы»',
  },
]
</script>

<style scoped lang="scss">
.step-menu-style-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.hint {
  color: var(--color-text-secondary);
}

.options {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}
</style>
