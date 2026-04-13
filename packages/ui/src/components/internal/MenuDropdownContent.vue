<template>
  <div class="menu-dropdown-content">
    <div v-if="$slots.header" class="header">
      <slot name="header" />
    </div>

    <div class="items">
      <template v-for="(item, index) in items" :key="index">
        <div v-if="item.isDivider" class="divider">
          <span v-if="item.label" class="divider-label">{{ item.label }}</span>
        </div>
        <div
          v-else
          class="item"
          :class="{ 'item--disabled': item.disabled, 'item--compact': compact }"
          @click="onItemClick(item)"
        >
          <ui-checkbox
            v-if="item.checked !== undefined"
            :model-value="item.checked"
            class="item-checkbox"
            @click.stop
          />
          <span v-if="item.color" class="item-dot" :style="{ background: item.color }" />
          <template v-else-if="item.icon">
            <img
              v-if="isExternalIcon(item.icon)"
              :src="item.icon"
              :alt="item.label"
              class="item-icon"
            />
            <ui-icon
              v-else
              :name="item.icon"
              :size="24"
              :color="item.iconColor ?? 'color-primary'"
            />
          </template>
          <span class="item-label">{{ item.label }}</span>
        </div>
      </template>
    </div>

    <div v-if="$slots.footer" class="footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiIcon } from '@fastio/icons'
import UiCheckbox from '../UiCheckbox.vue'
import type { UiMenuDropdownItem } from '../UiMenuDropdown.vue'

type Props = {
  items: UiMenuDropdownItem[]
  compact?: boolean
}

type Emits = {
  'item-click': [name: string]
  'close': []
}

defineProps<Props>()
const emit = defineEmits<Emits>()


function isExternalIcon(icon: string): boolean {
  return icon.startsWith('http') || icon.startsWith('/')
}

function onItemClick(item: UiMenuDropdownItem) {
  if (item.disabled) return

  if (item.checked === undefined) {
    emit('close')
  }

  if (item.link) {
    window.open(item.link, '_blank', 'noopener,noreferrer')

    return
  }

  if (item.onClick) {
    item.onClick()
  }

  emit('item-click', item.name)
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins' as *;

.header {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

.footer {
  padding: 12px 16px;
}

.items {
  display: flex;
  flex-direction: column;

  @include mq-xl {
    gap: 4px;
  }
}

.item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  padding: 0 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover:not(&--disabled) {
    background-color: var(--color-primary-light);
  }

  &:where(.item--disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:where(.item--compact) {
    height: 34px;
    padding: 0 10px;
    gap: 8px;
  }
}

.item-checkbox {
  flex-shrink: 0;
}

.item-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.item-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  object-fit: contain;
}

.item-label {
  font-family: var(--main-font);
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  color: var(--color-text);

  @include mq-xl {
    font-size: 16px;
  }
}

.divider {
  position: relative;
  height: 1px;
  margin: 12px 0;
  background-color: var(--color-border);
}

.divider-label {
  position: absolute;
  top: 50%;
  left: 50%;
  max-width: calc(100% - 16px);
  padding: 0 8px;
  background-color: var(--color-white);
  font-family: var(--main-font);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transform: translate(-50%, -50%);
}
</style>
