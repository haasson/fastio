<template>
  <div class="address-field">
    <UiInput
      v-model="model"
      :label="label"
      :placeholder="placeholder"
      :rules="rules"
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
import { UiInput } from '@fastio/ui'
import type { ValidationRule } from '@fastio/kit'
import { useDadataSuggestions, type DadataSuggestion } from '~/composables/delivery/useDadataSuggestions'

withDefaults(defineProps<{
  label?: string
  placeholder?: string
  rules?: ValidationRule[]
  disabled?: boolean
}>(), {
  label: 'Адрес',
  placeholder: 'Начните вводить адрес...',
})

const emit = defineEmits<{
  pick: [suggestion: DadataSuggestion]
}>()

const model = defineModel<string | null>({ default: '' })

const { suggestions, search, clear, showSuggestions, hideSuggestionsDelayed } = useDadataSuggestions()

const onInput = () => {
  showSuggestions.value = true
  search(model.value ?? '')
}

const pick = (s: DadataSuggestion) => {
  model.value = s.value
  showSuggestions.value = false
  clear()
  emit('pick', s)
}
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
  z-index: 20;
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
