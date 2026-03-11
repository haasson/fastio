<template>
  <n-menu
    :options="convertedOptions"
    :expanded-keys="expandedKeys"
    :value="value"
    accordion
    :indent="0"
    :expand-icon="renderExpandIcon"
    class="menu-root"
    v-bind="$attrs"
    @update:expanded-keys="handleExpandedKeysUpdate"
    @update:value="handleValueUpdate"
  />
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { NMenu, type MenuOption } from 'naive-ui'
import { UiIcon } from '@fastio/icons'
import type { IconName } from '@fastio/icons'

export type UiMenuKey = string | number

export type UiMenuOption = {
  key: UiMenuKey
  label: string
  icon?: IconName
  children?: UiMenuOption[]
  disabled?: boolean
  isFooter?: boolean
}

type Props = {
  options: UiMenuOption[]
  expandedKeys?: UiMenuKey[]
  value?: UiMenuKey
}

type Emits = {
  'update:expandedKeys': [keys: UiMenuKey[]]
  'update:value': [key: UiMenuKey]
}

const props = withDefaults(defineProps<Props>(), {
  expandedKeys: () => [],
})

const emit = defineEmits<Emits>()

const convertedOptions = computed<MenuOption[]>(() => {
  return convertOptions(props.options)
})

function convertOptions(options: UiMenuOption[]): MenuOption[] {
  return options.map((option) => {
    const menuOption: MenuOption = {
      key: option.key,
      disabled: option.disabled,
    }

    if (option.isFooter) {
      const iconName = option.icon

      menuOption.label = () =>
        h('span', { class: 'menu-item-footer' }, [
          option.label,
          iconName ? h(UiIcon, { name: iconName, size: 16, class: 'menu-item-footer-icon' }) : null,
        ])
    } else {
      menuOption.label = option.label

      if (option.icon) {
        const iconName = option.icon

        menuOption.icon = () => h(UiIcon, { name: iconName, size: 16, color: 'color-primary' })
      }
    }

    if (option.children && option.children.length > 0) {
      menuOption.children = convertOptions(option.children)
    }

    return menuOption
  })
}

function handleExpandedKeysUpdate(keys: UiMenuKey[]) {
  emit('update:expandedKeys', keys)
}

function handleValueUpdate(key: UiMenuKey) {
  emit('update:value', key)
}

function renderExpandIcon() {
  return h(UiIcon, { name: 'chevronRound', size: 24, color: 'blue-500' })
}
</script>

