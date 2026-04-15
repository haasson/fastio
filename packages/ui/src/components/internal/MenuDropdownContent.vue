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
  margin-bottom: var(--space-12);
  padding-bottom: var(--space-12);
  border-bottom: 1px solid var(--color-border);
}

.footer {
  padding: var(--space-12) var(--space-16);
}

.items {
  display: flex;
  flex-direction: column;

  @include mq-xl {
    gap: var(--space-4);
  }
}

.item {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  height: 48px;
  padding: 0 var(--space-12);
  border-radius: var(--radius-8);
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
    padding: 0 var(--space-8);
    gap: var(--space-8);
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
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  line-height: 1;
  color: var(--color-text);

  @include mq-xl {
    font-size: var(--font-size-lg);
  }
}

.divider {
  position: relative;
  height: 1px;
  margin: var(--space-12) 0;
  background-color: var(--color-border);
}

.divider-label {
  position: absolute;
  top: 50%;
  left: 50%;
  max-width: calc(100% - 16px);
  padding: 0 var(--space-8);
  background-color: var(--color-white);
  font-family: var(--main-font);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transform: translate(-50%, -50%);
}
</style>
