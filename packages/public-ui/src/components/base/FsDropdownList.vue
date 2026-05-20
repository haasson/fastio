<template>
  <div v-if="items.length" class="dropdown-list-root">
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="dropdown-item"
      @mousedown.prevent="emit('select', item)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
type DropdownItem = {
  value: string
  label: string
  [key: string]: unknown
}

type Props = {
  items: DropdownItem[]
}

defineProps<Props>()

const emit = defineEmits<{
  select: [item: DropdownItem]
}>()
</script>

<style scoped lang="scss">
.dropdown-list-root {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  z-index: var(--z-dropdown);
  overflow: hidden;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 10px 14px;
  text-align: left;
  font-size: 13px;
  color: var(--color-text);
  background: transparent;
  border: none;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  transition: background 0.1s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--primary-subtle);
  }
}
</style>
