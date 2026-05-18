<template>
  <div class="toolbar-root">
    <div class="toolbar-left">
      <UiInput
        v-if="searchPlaceholder !== undefined"
        v-model="searchModel"
        :placeholder="searchPlaceholder"
        clearable
        size="medium"
        class="search"
      />
      <slot name="filters" />
      <UiMenuDropdown
        v-if="columnOptions?.length"
        :items="columnMenuItems"
        @item-click="toggleColumn"
      >
        <template #trigger>
          <UiButton ghost size="medium">
            Столбцы {{ visibleModel.length }}/{{ columnOptions.length }}
          </UiButton>
        </template>
      </UiMenuDropdown>
      <UiFilterReset :count="filterCount ?? 0" @reset="$emit('reset')" />
    </div>
    <div class="toolbar-right">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { UiButton, UiFilterReset, UiInput, UiMenuDropdown } from '@fastio/ui'
import type { UiMenuDropdownItem } from '@fastio/ui'

type ColumnOption = { label: string; value: string }

const props = defineProps<{
  searchPlaceholder?: string
  filterCount?: number
  columnOptions?: ColumnOption[]
  storageKey?: string
}>()

defineEmits<{ reset: [] }>()

const searchModel = defineModel<string>('search', { default: '' })
const visibleModel = defineModel<string[]>('visibleColumns', {
  default: () => [],
})

// Initialize from localStorage on mount if storageKey given
onMounted(() => {
  if (!props.storageKey || !props.columnOptions) return
  const all = props.columnOptions.map((c) => c.value)

  try {
    const raw = localStorage.getItem(props.storageKey)
    const parsed = raw ? (JSON.parse(raw) as string[]) : null
    const valid = parsed ? parsed.filter((k) => all.includes(k)) : null

    visibleModel.value = valid?.length ? valid : all
  } catch {
    // localStorage недоступен или JSON битый — фолбэк на все колонки
    visibleModel.value = all
  }
})

const saveToStorage = (keys: string[]) => {
  if (props.storageKey) localStorage.setItem(props.storageKey, JSON.stringify(keys))
}

const columnMenuItems = computed<UiMenuDropdownItem[]>(() => (props.columnOptions ?? []).map((col) => ({
  name: col.value,
  label: col.label,
  checked: visibleModel.value.includes(col.value),
})),
)

const toggleColumn = (key: string) => {
  const current = visibleModel.value
  const next = current.includes(key)
    ? current.length > 1 ? current.filter((k) => k !== key) : current
    : [...current, key]

  visibleModel.value = next
  saveToStorage(next)
}
</script>

<style scoped lang="scss">
.toolbar-root {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--space-12);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.search {
  width: 220px;
}
</style>
