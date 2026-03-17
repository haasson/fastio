<template>
  <SelectRoot
    :model-value="stringValue"
    :disabled="disabled"
    @update:model-value="onValueChange"
  >
    <SelectTrigger
      class="select-trigger"
      :class="[`size-${size}`, { 'is-error': error, 'is-disabled': disabled }]"
    >
      <SelectValue :placeholder="placeholder" class="select-value" />
      <SelectIcon class="select-icon">
        <ChevronDown :size="16" />
      </SelectIcon>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent class="sf-select-content" :side-offset="4" position="popper">
        <SelectViewport class="sf-select-viewport">
          <SelectItem
            v-for="option in options"
            :key="option.value"
            :value="String(option.value)"
            :disabled="option.disabled"
            class="sf-select-item"
          >
            <SelectItemText class="sf-select-item-text">{{ option.label }}</SelectItemText>
            <span class="sf-select-item-check">
              <Check :size="14" />
            </span>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectItemText,
  SelectIcon,
} from 'reka-ui'
import { ChevronDown, Check } from 'lucide-vue-next'

type Option = {
  value: string | number
  label: string
  disabled?: boolean
}

type Props = {
  modelValue?: string | number | null
  placeholder?: string
  disabled?: boolean
  error?: boolean
  size?: 'small' | 'medium' | 'large'
  options: Option[]
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Выберите...',
  size: 'medium',
  disabled: false,
  error: false,
  modelValue: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

function onValueChange(value: string) {
  emit('update:modelValue', value)
}

const stringValue = computed(() =>
  props.modelValue !== null && props.modelValue !== undefined
    ? String(props.modelValue)
    : undefined,
)
</script>

<!-- Trigger: scoped, рендерится внутри компонента -->
<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-btn);
  color: var(--color-text);
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  font-family: inherit;
  height: var(--ctrl-h);
  padding: 0 var(--ctrl-px);
  font-size: var(--ctrl-fs);
  gap: var(--ctrl-gap);

  &:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-subtle);
  }

  &.is-error {
    border-color: var(--color-error, #ef4444);

    &:focus {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-error, #ef4444) 15%, transparent);
    }
  }

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
}

.select-value {
  flex: 1;
  text-align: left;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  &[data-placeholder] {
    color: var(--color-text-muted);
  }
}

.select-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: transform 0.2s;

  [data-state='open'] & {
    transform: rotate(180deg);
  }
}
</style>

<!-- Portal content: не scoped, телепортируется внутрь .app-root -->
<style lang="scss">
.sf-select-content {
  font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: 14px;
  line-height: 1;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.06),
    0 8px 24px rgba(0, 0, 0, 0.10);
  z-index: var(--z-dropdown);
  min-width: var(--reka-select-trigger-width);
  max-height: var(--reka-select-content-available-height);
  overflow: hidden;

  &[data-state='open'] {
    animation: sf-select-open 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  }

  &[data-state='closed'] {
    animation: sf-select-close 0.12s ease;
  }
}

@keyframes sf-select-open {
  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes sf-select-close {
  from { opacity: 1; }
  to   { opacity: 0; transform: translateY(-4px); }
}

.sf-select-viewport {
  padding: 4px;
  overflow-y: auto;
  max-height: inherit;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 99px; }
}

.sf-select-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-radius: calc(var(--radius-card) - 5px);
  cursor: pointer;
  outline: none;
  transition: background 0.1s, color 0.1s;
  user-select: none;

  // Явно задаём цвет на каждое состояние — без сюрпризов от браузера
  color: var(--color-text);

  &[data-highlighted] {
    background: var(--surface-hover);
    color: var(--color-text);
  }

  &[data-state='checked'] {
    color: var(--primary);
  }

  &[data-highlighted][data-state='checked'] {
    background: var(--primary-subtle);
    color: var(--primary);
  }

  &[data-disabled] {
    opacity: 0.38;
    cursor: not-allowed;
    pointer-events: none;
    color: var(--color-text-muted);
  }
}

.sf-select-item-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 1.4;

  [data-state='checked'] & { font-weight: 500; }
}

.sf-select-item-check {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  opacity: 0;
  transition: opacity 0.1s;

  [data-state='checked'] & { opacity: 1; }
}
</style>
