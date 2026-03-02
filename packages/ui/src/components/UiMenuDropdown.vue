<template>
  <ui-popover
    v-if="!inline"
    :show="internalShow"
    :show-arrow="false"
    v-bind="$attrs"
    class="menu-dropdown-root"
    @update:show="handleShowUpdate"
  >
    <template #trigger>
      <slot name="trigger" />
    </template>

    <menu-dropdown-content
      :items="items"
      @item-click="emit('item-click', $event)"
      @close="close"
    >
      <template v-if="$slots.header" #header>
        <slot name="header" />
      </template>
      <template v-if="$slots.footer" #footer>
        <slot name="footer" />
      </template>
    </menu-dropdown-content>
  </ui-popover>

  <menu-dropdown-content
    v-else
    :items="items"
    @item-click="emit('item-click', $event)"
    @close="close"
  >
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </menu-dropdown-content>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import UiPopover from './UiPopover.vue'
import MenuDropdownContent from './internal/MenuDropdownContent.vue'

export type UiMenuDropdownItem = {
  label?: string
  name: string
  icon?: string
  link?: string
  onClick?: () => void
  isDivider?: boolean
  disabled?: boolean
  checked?: boolean
}

type Props = {
  items: UiMenuDropdownItem[]
  inline?: boolean
  show?: boolean
}

type Emits = {
  'item-click': [name: string]
  'update:show': [value: boolean]
}

const props = withDefaults(defineProps<Props>(), {
  inline: false,
  show: undefined,
})
const emit = defineEmits<Emits>()

const internalShow = ref(props.show ?? false)

watch(
  () => props.show,
  (value) => {
    if (value !== undefined) {
      internalShow.value = value
    }
  },
)

function handleShowUpdate(value: boolean) {
  internalShow.value = value
  emit('update:show', value)
}

function close() {
  internalShow.value = false
  emit('update:show', false)
}

defineOptions({
  inheritAttrs: false,
})
</script>
