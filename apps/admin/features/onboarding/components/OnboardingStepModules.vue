<template>
  <div class="step-modules-root">
    <UiTitle size="h3">Способы заказа</UiTitle>
    <UiText size="small" class="hint">
      Выберите хотя бы один способ, которым клиенты смогут сделать заказ.
    </UiText>

    <UiText v-if="showError && !delivery && !pickup && !dineIn" size="small" class="error">Выберите хотя бы один способ заказа</UiText>

    <div class="options">
      <UiPickerItem
        v-for="option in options"
        :key="option.key"
        :selected="option.value"
        class="option"
        @click="toggle(option.key)"
      >
        <span class="option-icon">{{ option.emoji }}</span>
        <div class="option-body">
          <UiText size="medium" class="option-title">{{ option.title }}</UiText>
          <UiText size="small" class="option-desc">{{ option.desc }}</UiText>
        </div>
        <div class="toggle-indicator" :class="{ on: option.value }" />
      </UiPickerItem>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { UiTitle, UiText, UiPickerItem } from '@fastio/ui'

const props = defineProps<{
  delivery: boolean
  pickup: boolean
  dineIn: boolean
  menuStyle: 'food' | 'catalog'
}>()

const emit = defineEmits<{
  'update:delivery': [value: boolean]
  'update:pickup': [value: boolean]
  'update:dineIn': [value: boolean]
}>()

type ModuleKey = 'delivery' | 'pickup' | 'dineIn'

const options = computed(() => {
  const all: { key: ModuleKey; emoji: string; title: string; desc: string; value: boolean }[] = [
    {
      key: 'delivery',
      emoji: '🚗',
      title: 'Доставка',
      desc: 'Курьер привозит заказ клиенту',
      value: props.delivery,
    },
    {
      key: 'pickup',
      emoji: '🏃',
      title: 'Самовывоз',
      desc: 'Клиент забирает заказ сам',
      value: props.pickup,
    },
    {
      key: 'dineIn',
      emoji: '🍽️',
      title: 'За столиком',
      desc: 'Заказ и оплата прямо в заведении',
      value: props.dineIn,
    },
  ]

  return props.menuStyle === 'catalog' ? all.filter((o) => o.key !== 'dineIn') : all
})

const showError = ref(false)

defineExpose({
  validate: () => {
    if (!props.delivery && !props.pickup && !props.dineIn) {
      showError.value = true

      return false
    }

    return true
  },
})

const toggle = (key: ModuleKey) => {
  if (key === 'delivery') emit('update:delivery', !props.delivery)
  else if (key === 'pickup') emit('update:pickup', !props.pickup)
  else if (key === 'dineIn') emit('update:dineIn', !props.dineIn)
}
</script>

<style scoped lang="scss">
.step-modules-root {
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

// UiPickerItem уже даёт border/hover/focus ring. Здесь — full-width card layout.
.option {
  --picker-hover-border: var(--color-primary);

  display: flex;
  align-items: center;
  gap: var(--space-16);
  padding: var(--space-16);
  border-color: var(--color-border);
  border-radius: var(--radius-12);
  background: var(--color-bg-card);
  text-align: left;

  &.ui-picker-item--selected {
    background: var(--color-bg-hover);
  }
}

// Декоративный icon-emoji: размер не на типографической шкале.
/* stylelint-disable scale-unlimited/declaration-strict-value */
.option-icon {
  font-size: 28px;
  line-height: 1;
  flex-shrink: 0;
}
/* stylelint-enable scale-unlimited/declaration-strict-value */

.option-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  flex: 1;
}

.option-title {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.option-desc {
  color: var(--color-text-secondary);
}

.error {
  color: var(--color-error);
}

.toggle-indicator {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;

  &.on {
    background: var(--color-primary);
    border-color: var(--color-primary);
  }
}
</style>
