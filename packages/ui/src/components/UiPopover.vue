<template>
  <client-only>
    <template v-if="showSheet">
      <span @click="!disabled && (isSheetOpen = true)">
        <slot name="trigger" />
      </span>
      <ui-bottom-sheet v-model="isSheetOpen">
        <slot />
      </ui-bottom-sheet>
    </template>

    <n-popover
      v-else
      v-bind="$attrs"
      :disabled="disabled"
      :class="{ 'ui-dark-side dark': dark, 'ui-popover--accent': accent }"
      :style="popoverStyle"
    >
      <template #trigger>
        <slot name="trigger" />
      </template>
      <template v-if="$slots.header" #header>
        <slot name="header" />
      </template>
      <div v-if="width" :style="{ width: `${width}px` }">
        <slot />
      </div>
      <slot v-else />
    </n-popover>

    <template #fallback>
      <slot name="trigger" />
    </template>
  </client-only>
</template>

<script setup lang="ts">
import { ref, computed, type CSSProperties } from 'vue'
import { NPopover } from 'naive-ui'
import ClientOnly from './internal/ClientOnly.vue'
import UiBottomSheet from './UiBottomSheet.vue'
import { useBreakpoints } from '@fastio/kit'
import type { Breakpoint } from '@fastio/kit'

type Props = {
  dark?: boolean
  offset?: number
  padding?: number
  sheetUntil?: Exclude<Breakpoint, 'xl'>
  width?: number
  disabled?: boolean
  noSheet?: boolean
  accent?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  sheetUntil: 's',
})

const breakpoints = useBreakpoints()
const showSheet = computed(() => {
  if (props.noSheet) return false

  switch (props.sheetUntil) {
    case 's': return !breakpoints.m.value
    case 'm': return !breakpoints.l.value
    case 'l': return !breakpoints.xl.value
    default: return !breakpoints.m.value
  }
})

const isSheetOpen = ref(false)

const popoverStyle = computed(() => {
  const styles: CSSProperties = {}

  if (props.offset) {
    styles.margin = `${props.offset}px`
  }

  if (props.padding) {
    styles.padding = `${props.padding}px`
  }

  return styles
})
</script>
