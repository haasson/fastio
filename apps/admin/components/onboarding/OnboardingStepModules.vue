<template>
  <div class="step-modules-root">
    <UiTitle size="h3">Способы заказа</UiTitle>
    <UiText size="small" class="hint">
      Выберите хотя бы один способ, которым клиенты смогут сделать заказ.
    </UiText>

    <div class="options">
      <button
        v-for="option in options"
        :key="option.key"
        class="option"
        :class="{ selected: option.value }"
        @click="toggle(option.key)"
      >
        <span class="option-icon">{{ option.emoji }}</span>
        <div class="option-body">
          <UiText size="medium" class="option-title">{{ option.title }}</UiText>
          <UiText size="small" class="option-desc">{{ option.desc }}</UiText>
        </div>
        <div class="toggle-indicator" :class="{ on: option.value }" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiTitle, UiText } from '@fastio/ui'

const props = defineProps<{
  delivery: boolean
  pickup: boolean
  dineIn: boolean
}>()

const emit = defineEmits<{
  'update:delivery': [value: boolean]
  'update:pickup': [value: boolean]
  'update:dineIn': [value: boolean]
}>()

type ModuleKey = 'delivery' | 'pickup' | 'dineIn'

const options = computed(() => [
  {
    key: 'delivery' as ModuleKey,
    emoji: '🚗',
    title: 'Доставка',
    desc: 'Курьер привозит заказ клиенту',
    value: props.delivery,
  },
  {
    key: 'pickup' as ModuleKey,
    emoji: '🏃',
    title: 'Самовывоз',
    desc: 'Клиент забирает заказ сам',
    value: props.pickup,
  },
  {
    key: 'dineIn' as ModuleKey,
    emoji: '🍽️',
    title: 'За столиком',
    desc: 'Заказ и оплата прямо в заведении',
    value: props.dineIn,
  },
])

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
  }

  &.selected {
    border-color: var(--color-primary);
    background: var(--color-bg-hover);
  }
}

.option-icon {
  font-size: 28px;
  line-height: 1;
  flex-shrink: 0;
}

.option-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.option-title {
  font-weight: 600;
  color: var(--color-text);
}

.option-desc {
  color: var(--color-text-secondary);
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
