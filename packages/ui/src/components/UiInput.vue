<template>
  <form-item
    :label="label"
    :size="computedSize"
    :name="name"
    :rules="rules"
    :model-value="value"
    :status="status"
    :feedback="feedback"
    v-slot="{ hasError }"
  >
    <n-input
      v-model:value="value"
      v-maska="phoneMask"
      :size="computedSize"
      :class="inputClasses"
      :clearable="(statusIconName && !hasError) ? false : isClearable"
      :placeholder="resolvedPlaceholder"
      :status="hasError ? 'error' : (status || undefined)"
      v-bind="$attrs"
      :type="effectiveType"
      :input-props="nativeInputProps"
    >
      <template #prefix v-if="$slots.prefix">
        <slot name="prefix" />
      </template>
      <template #suffix v-if="$slots.suffix || isPasswordType || (statusIconName && !hasError)">
        <slot name="suffix" />
        <span
          v-if="isPasswordType"
          class="password-toggle"
          @pointerdown.stop.prevent
          @click.stop="togglePasswordVisibility"
        >
          <ui-icon
            :name="passwordVisible ? 'eye' : 'eyeClose'"
            :size="iconSize"
            color="grey-500"
          />
        </span>
        <span
          v-if="statusIconName && !hasError"
          class="status-suffix"
          :class="{ 'has-value': !!value }"
          @click.stop="handleStatusClear"
        >
          <ui-icon
            class="status-icon"
            :name="statusIconName"
            :size="24"
            :color="statusColor"
          />
          <ui-icon
            class="clear-icon"
            name="crossRound"
            :size="24"
            color="grey-400"
          />
        </span>
      </template>
      <template #clear-icon>
        <ui-icon
          name="crossRound"
          :size="iconSize"
          color="grey-400"
        />
      </template>
    </n-input>
  </form-item>
</template>

<script setup lang="ts">
import { computed, ref, useAttrs } from 'vue'
import { NInput } from 'naive-ui'
import { vMaska } from 'maska/vue'
import UiIcon from './UiIcon.vue'
import type { IconName } from '../icons'
import FormItem from './internal/FormItem.vue'
import useResponsiveSize from '../composables/useResponsiveSize'
import type { Size, ResponsiveSizeMap } from '../types/responsive'
import type { ValidationRule } from '../types/form'

type Props = {
  label?: string
  clearable?: boolean
  size?: Size
  responsive?: ResponsiveSizeMap
  name?: string
  rules?: ValidationRule[]
  stateless?: boolean
  status?: 'success' | 'warning' | 'error'
  feedback?: string
  inputmode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
}

const props = withDefaults(defineProps<Props>(), {
  clearable: true,
  size: 'medium',
})

const attrs = useAttrs()
const value = defineModel<string>({ default: '' })
const passwordVisible = ref(false)

const nativeInputProps = computed(() => {
  if (!props.inputmode) return undefined

  return { inputmode: props.inputmode }
})

const isPasswordType = computed(() => attrs.type === 'password')

type InputType = 'text' | 'textarea' | 'password'

const effectiveType = computed((): InputType | undefined => {
  if (isPasswordType.value && passwordVisible.value) return 'text'

  return attrs.type as InputType | undefined
})

const togglePasswordVisibility = () => {
  passwordVisible.value = !passwordVisible.value
}

const computedSize = useResponsiveSize({
  size: props.size,
  responsive: props.responsive,
})

const inputSize = computed(() => computedSize.value)

const hasPhoneValidation = computed(() => {
  return props.rules?.some((rule) => rule.type === 'phone')
})

const hasEmailValidation = computed(() => {
  return props.rules?.some((rule) => rule.type === 'email')
})

const phoneMask = computed(() => {
  return hasPhoneValidation.value ? '+7 (###) ###-##-##' : undefined
})

const resolvedPlaceholder = computed(() => {
  if (attrs.placeholder) return attrs.placeholder as string

  if (hasPhoneValidation.value) return '+7 (999) 999-99-99'
  if (hasEmailValidation.value) return 'E-mail'
  if (attrs.type === 'password') return 'Пароль'

  return undefined
})

const isClearable = computed(() => {
  if (attrs.type === 'password') return false

  return props.clearable
})

const inputClasses = computed(() => {
  return {
    'input': true,
    [`input--${inputSize.value}`]: true,
    'input--stateless': props.stateless,
  }
})

const statusIconName = computed<'checkRound' | 'warningRound' | undefined>(() => {
  if (props.status === 'success') return 'checkRound'
  if (props.status === 'warning') return 'warningRound'

  return undefined
})

const statusColor = computed(() => {
  if (props.status === 'success') return 'color-success'
  if (props.status === 'warning') return 'color-warning'

  return undefined
})

const handleStatusClear = () => {
  if (value.value) {
    value.value = ''
  }
}

const iconSize = computed(() => {
  switch (inputSize.value) {
    case 'tiny': return 12
    case 'small': return 14
    case 'medium': return 16
    case 'large': return 24
    default: return 16
  }
})

defineOptions({
  inheritAttrs: false,
})
</script>

<style scoped lang="scss">
.input {
  &:deep(.n-base-clear__clear) {
    width: unset;
    height: unset;
  }

  &:deep(.n-input__border) {
    transition: opacity .3s ease;
  }

  &:hover:not(.n-input--disabled),
  &.n-input--focus,
  &.n-input--error-status,
  &.n-input--warning-status,
  &.n-input--success-status {
    &:deep(.n-input__border) {
      opacity: 0;
    }
  }

  &.n-input--success-status {
    &:deep(.n-input__state-border) {
      border: 2px solid var(--color-success);
    }

    &:hover:not(.n-input--disabled) {
      &:deep(.n-input__state-border) {
        border-color: var(--color-success);
      }
    }

    &.n-input--focus {
      &:deep(.n-input__state-border) {
        border-color: var(--color-success);
      }
    }
  }

  &:where(.input--tiny) {
    &:deep(.n-input-wrapper) {
      border-radius: 6px;
    }
    &:deep(.n-input__suffix) {
      --n-icon-size: 12px;
    }
  }

  &:where(.input--small) {
    &:deep(.n-input-wrapper) {
      border-radius: 8px;
    }
    &:deep(.n-input__suffix) {
      --n-icon-size: 14px;
    }
  }

  &:where(.input--medium) {
    &:deep(.n-input-wrapper) {
      border-radius: 12px;
    }
    &:deep(.n-input__suffix) {
      --n-icon-size: 16px;
    }
  }

  &:where(.input--large) {
    &:deep(.n-input-wrapper) {
      border-radius: 12px;
    }
    &:deep(.n-input__suffix) {
      --n-icon-size: 24px;
    }
  }

  &:where(.input--stateless) {
    &:deep(.n-input__border),
    &:deep(.n-input__state-border) {
      display: none;
    }

    &:deep(.n-input-wrapper) {
      background: transparent;
    }
  }
}

.password-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.status-suffix {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  .status-icon,
  .clear-icon {
    transition: opacity 0.15s ease;
  }

  .clear-icon {
    position: absolute;
    opacity: 0;
  }

  &.has-value:hover {
    cursor: pointer;

    .status-icon {
      opacity: 0;
    }

    .clear-icon {
      opacity: 1;
    }
  }
}
</style>
