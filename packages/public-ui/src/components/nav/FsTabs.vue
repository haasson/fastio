<template>
  <TabsRoot
    v-model="currentValue"
    class="tabs-root"
    :class="[`tabs-${variant}`, `tabs-${size}`, { 'tabs-full': fullWidth }]"
  >
    <TabsList class="tabs-list">
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.value"
        :value="tab.value"
        :disabled="tab.disabled"
        class="tabs-trigger"
        :class="{ 'tabs-trigger-full': fullWidth }"
      >
        {{ tab.label }}
        <span v-if="tab.badge !== undefined" class="tabs-badge">{{ tab.badge }}</span>
      </TabsTrigger>
    </TabsList>

    <div class="tabs-panels">
      <template v-for="tab in tabs" :key="tab.value">
        <div v-show="modelValue === tab.value">
          <slot :name="tab.value" />
        </div>
      </template>
    </div>
  </TabsRoot>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { TabsRoot, TabsList, TabsTrigger } from 'reka-ui'

type Tab = {
  value: string
  label: string
  disabled?: boolean
  badge?: string | number
}

type Props = {
  modelValue?: string
  tabs: Tab[]
  variant?: 'line' | 'pill'
  size?: 'sm' | 'md'
  fullWidth?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'line',
  size: 'md',
  fullWidth: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const currentValue = computed({
  get: () => props.modelValue,
  set: (val) => {
    if (val !== undefined) emit('update:modelValue', val)
  },
})
</script>
<style scoped lang="scss">
.tabs-root {
  display: flex;
  flex-direction: column;
}

// ─── Line variant ───────────────────────────────────────────────────────────

.tabs-line .tabs-list {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  gap: 0;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.tabs-line .tabs-trigger {
  position: relative;
  padding: 10px 16px;
  font-size: 14px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: transparent;
  border-top: none;
  border-left: none;
  border-right: none;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;

  &[data-state='active'] {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  &:hover:not([data-disabled]) {
    color: var(--color-text);
  }

  &[data-disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.tabs-line.tabs-sm .tabs-trigger {
  padding: 8px 12px;
  font-size: 13px;
}

// ─── Pill variant ────────────────────────────────────────────────────────────

.tabs-pill .tabs-list {
  display: flex;
  gap: 4px;
  background: var(--color-surface);
  padding: 4px;
  border-radius: calc(var(--radius-btn) + 4px);
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.tabs-pill .tabs-trigger {
  padding: 8px 16px;
  font-size: 14px;
  border-radius: var(--radius-btn);
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;

  &[data-state='active'] {
    background: var(--primary);
    color: var(--on-primary);
  }

  &:hover:not([data-state='active']):not([data-disabled]) {
    background: var(--surface-hover);
    color: var(--color-text);
  }

  &[data-disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.tabs-pill.tabs-sm .tabs-trigger {
  padding: 4px 10px;
  font-size: 13px;
}

// ─── Full width ──────────────────────────────────────────────────────────────

.tabs-trigger-full {
  flex: 1;
  justify-content: center;
}

// ─── Badge ───────────────────────────────────────────────────────────────────

.tabs-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-subtle);
  color: var(--primary);
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 999px;
  margin-left: 4px;
  line-height: 1.4;
}

[data-state='active'] .tabs-badge {
  background: rgba(255, 255, 255, 0.25);
  color: var(--on-primary);
}

// ─── Panels ──────────────────────────────────────────────────────────────────

.tabs-panels {
  margin-top: 16px;
}
</style>
