<template>
  <div
    class="stepper-root"
    :class="[`size-${size}`, { 'is-responsive': responsive }]"
  >
    <button
      class="stepper-btn"
      type="button"
      :disabled="isAtMin"
      @click="decrement"
    >
      <Minus :size="size === 'small' ? 14 : 16" />
    </button>
    <span class="stepper-value">{{ modelValue }}</span>
    <button
      class="stepper-btn"
      type="button"
      :disabled="isAtMax"
      @click="increment"
    >
      <Plus :size="size === 'small' ? 14 : 16" />
    </button>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { Minus, Plus } from 'lucide-vue-next'

type Props = {
  modelValue: number
  min?: number
  max?: number
  size?: 'small' | 'medium' | 'large'
  responsive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 999,
  size: 'medium',
  responsive: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const isAtMin = computed(() => props.modelValue <= props.min)
const isAtMax = computed(() => props.modelValue >= props.max)

function decrement() {
  if (!isAtMin.value) {
    emit('update:modelValue', props.modelValue - 1)
  }
}

function increment() {
  if (!isAtMax.value) {
    emit('update:modelValue', props.modelValue + 1)
  }
}
</script>
<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.stepper-root {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-btn);
  overflow: hidden;
}

.stepper-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--primary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;

  &:hover:not(:disabled) {
    background: var(--primary-subtle);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.stepper-value {
  text-align: center;
  font-weight: 600;
  color: var(--color-text);
  flex-shrink: 0;
}

// Sizes
.size-small {
  .stepper-btn {
    width: 28px;
    height: 28px;
    @include text-xs;
  }
  .stepper-value {
    min-width: 28px;
    @include text-xs;
  }
}

.size-medium {
  .stepper-btn {
    width: 36px;
    height: 36px;
    @include text-body-sm;
  }
  .stepper-value {
    min-width: 36px;
    @include text-body-sm;
  }
}

.size-large {
  .stepper-btn {
    width: 44px;
    height: 44px;
    @include text-body;
  }
  .stepper-value {
    min-width: 44px;
    @include text-body;
  }
}

// Responsive: small→medium
.size-small.is-responsive {
  @include lg {
    .stepper-btn {
      width: 36px;
      height: 36px;
      @include text-body-sm;
    }
    .stepper-value {
      min-width: 36px;
      @include text-body-sm;
    }
  }
}
</style>
