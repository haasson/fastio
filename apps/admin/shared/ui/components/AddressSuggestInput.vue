<template>
  <div class="address-field">
    <UiInput
      v-model="model"
      :name="name"
      :label="label"
      :placeholder="placeholder"
      :rules="allRules"
      :disabled="disabled"
      @input="onInput"
      @focus="showSuggestions = true"
      @blur="hideSuggestionsDelayed"
    />
    <div v-if="showSuggestions && suggestions.length" class="suggestions-dropdown">
      <button
        v-for="(s, i) in suggestions"
        :key="i"
        class="suggestion-item"
        @mousedown.prevent="pick(s)"
      >
        {{ s.value }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiInput } from '@fastio/ui'
import type { ValidationRule } from '@fastio/kit'
import type { BranchAddressData } from '@fastio/shared'
import { useDadataSuggestions, type DadataSuggestion } from '~/shared/composables/delivery/useDadataSuggestions'

const props = withDefaults(defineProps<{
  name?: string
  label?: string
  placeholder?: string
  rules?: ValidationRule[]
  disabled?: boolean
  /**
   * true (default) — UiForm-валидация требует, чтобы текущий address был выбран
   * из подсказок DaData (addressData != null && совпадает с input).
   * Используется в формах филиала, где BD-CHECK гарантирует структурный адрес.
   */
  requirePicked?: boolean
  /** city-only режим: подсказки только города/нас. пункты. Для онбординга showcase. */
  cityOnly?: boolean
}>(), {
  label: 'Адрес *',
  placeholder: 'Начните вводить адрес...',
  requirePicked: true,
  cityOnly: false,
})

const emit = defineEmits<{
  pick: [suggestion: DadataSuggestion]
}>()

const model = defineModel<string>({ default: '' })
// addressData либо синхронизирован с model (после pick), либо null (после ручной правки).
// Parent обязан хранить его рядом с address — серверная валидация заберёт оба поля.
const addressData = defineModel<BranchAddressData | null>('addressData', { default: null })

const { suggestions, search, clear, showSuggestions, hideSuggestionsDelayed } = useDadataSuggestions({ cityOnly: props.cityOnly })

const onInput = () => {
  showSuggestions.value = true
  search(model.value ?? '')
  // Любая ручная правка после pick выводит из «verified»-состояния.
  // Идентично паттерну AddressManualInput на чекауте.
  addressData.value = null
}

const pick = (s: DadataSuggestion) => {
  model.value = s.value
  // Сохраняем сырые данные DaData как addressData. value жёстко синхронизируем
  // с input, чтобы CHECK-constraint в БД не упал.
  addressData.value = { ...(s.data as BranchAddressData), value: s.value }
  showSuggestions.value = false
  clear()
  emit('pick', s)
}

// Встроенная rule «адрес выбран из подсказок» — добавляется к пользовательским
// rules. Срабатывает только когда уже введено что-то непустое: пустоту ловит
// внешний required, чтобы не дублировать сообщения.
const pickedRule: ValidationRule = {
  type: 'custom',
  message: 'Выберите адрес из всплывающей подсказки',
  validator: (value: unknown) => {
    if (!props.requirePicked) return true

    const str = typeof value === 'string' ? value.trim() : ''

    if (str === '') return true

    return addressData.value != null && addressData.value.value === value
  },
}

const allRules = computed<ValidationRule[]>(() => [...(props.rules ?? []), pickedRule])
</script>

<style scoped lang="scss">
.address-field {
  position: relative;
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: var(--z-dropdown);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  margin-top: var(--space-4);
  overflow: hidden;
}

.suggestion-item {
  display: block;
  width: 100%;
  padding: var(--space-8) var(--space-12);
  border: none;
  background: none;
  text-align: left;
  font-size: var(--font-size-base);
  color: var(--color-text);
  cursor: pointer;
  transition: background 0.1s;

  &:hover { background: var(--color-bg-hover); }

  & + & { border-top: 1px solid var(--color-border-light); }
}
</style>
