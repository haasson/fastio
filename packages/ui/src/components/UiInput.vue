<template>
  <form-item
    :label="label"
    :size="computedSize"
    :name="name"
    :rules="rules"
    :message="message"
    :model-value="value"
    :status="status"
    :feedback="feedback"
  >
    <template v-if="callable && cleanPhone" #label-suffix>
      <a :href="`tel:${cleanPhone}`" class="callable-link">Позвонить</a>
    </template>
    <template #default="{ hasError }">
    <n-input
      v-model:value="value"
      v-maska="phoneMask"
      :size="computedSize"
      class="input"
      :clearable="(statusIconName && !hasError) ? false : isClearable"
      :placeholder="resolvedPlaceholder"
      :status="hasError ? 'error' : (status || undefined)"
      v-bind="$attrs"
      :type="effectiveType"
      :maxlength="resolvedMaxlength"
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
    </template>
  </form-item>
</template>

<script setup lang="ts">
import { computed, ref, useAttrs } from 'vue'
import { NInput } from 'naive-ui'
import { vMaska } from 'maska/vue'
import { UiIcon } from '@fastio/icons'
import type { IconName } from '@fastio/icons'
import FormItem from './internal/FormItem.vue'
import { useResponsiveSize } from '@fastio/kit'
import type { Size, ResponsiveSizeMap } from '@fastio/kit'
import type { ValidationRule } from '@fastio/kit'

type Props = {
  label?: string
  clearable?: boolean
  size?: Size
  responsive?: ResponsiveSizeMap
  name?: string
  rules?: ValidationRule[]
  stateless?: boolean
  message?: string
  status?: 'success' | 'warning' | 'error'
  feedback?: string
  inputmode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
  maxlength?: number
  callable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  clearable: true,
  size: 'medium',
  maxlength: 500,
})

const attrs = useAttrs()
const value = defineModel<string | null>({ default: '' })
const passwordVisible = ref(false)

const nativeInputProps = computed(() => {
  if (!props.inputmode) return undefined

  return { inputmode: props.inputmode }
})

const isPasswordType = computed(() => attrs.type === 'password')

const resolvedMaxlength = computed(() => {
  if (attrs.type === 'textarea') return undefined
  return props.maxlength
})

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

const cleanPhone = computed(() => {
  if (!value.value) return null
  const digits = value.value.replace(/\D/g, '')
  return digits.length >= 11 ? `+${digits}` : null
})

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
  switch (computedSize.value) {
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
.callable-link {
  margin-left: 6px;
  font-size: 12px;
  color: var(--color-primary);
  text-decoration: none;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
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
