<template>
  <div class="ui-grid-root">
    <component
      v-if="items"
      :is="gridComponent"
      tag="div"
      class="grid"
      :style="gridStyles"
      name="expand"
    >
      <template v-for="(item, index) in displayedItems" :key="getItemKey(item, index)">
        <slot :item="item" :index="index" />
      </template>
    </component>

    <!-- @vue-ignore slot used without items prop — manual children mode -->
    <div v-else class="grid" :style="gridStyles">
      <slot />
    </div>

    <div v-if="showToggle" ref="buttonWrapperRef" class="button-wrapper">
      <slot
        name="toggle"
        :expanded="isExpanded"
        :toggle="toggle"
        :loading="props.loading"
      >
        <ui-button
          text
          :icon="isExpanded ? 'minusRound' : 'plusRound'"
          icon-bg="grey-200"
          icon-fg="grey-700"
          :loading="props.loading"
          class="toggle-button"
          @click="toggle"
        >
          {{ isExpanded ? 'Свернуть' : 'Показать еще' }}
        </ui-button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { computed, ref, shallowRef, onMounted, watch, TransitionGroup, type Component } from 'vue'
import { useBreakpoints } from '@fastio/kit'
import type { Breakpoint } from '@fastio/kit'
import { BREAKPOINTS_ORDER } from '@fastio/kit'
import UiButton from './UiButton.vue'

type ResponsiveNumber = Partial<Record<Breakpoint, number>>

type Props = {
  columns?: number | ResponsiveNumber
  gap?: number | ResponsiveNumber
  items?: T[]
  expandable?: boolean
  batchSize?: number
  keyField?: keyof T
  noAnimation?: boolean
  async?: boolean
  loading?: boolean
  endReached?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  columns: () => ({ s: 1, m: 2 }),
  gap: () => ({ s: 8, l: 12 }),
  expandable: false,
  batchSize: 4,
  noAnimation: false,
  async: false,
  loading: false,
  endReached: false,
})

type Emits = {
  'load-more': []
  'collapse': []
}

const emit = defineEmits<Emits>()

defineSlots<{
  default(props: { item: T; index: number } | Record<string, never>): unknown
  toggle(props: { expanded: boolean; toggle: () => void; loading: boolean }): unknown
}>()

const { active } = useBreakpoints()

const gridComponent = shallowRef<string | Component>('div')

onMounted(() => {
  if ((props.expandable || props.async) && !props.noAnimation) {
    gridComponent.value = TransitionGroup
  }
})

const getResponsiveValue = (value: number | ResponsiveNumber, fallback: number): number => {
  if (typeof value === 'number') {
    return value
  }

  const currentBreakpoint = active.value as Breakpoint
  const currentIndex = BREAKPOINTS_ORDER.indexOf(currentBreakpoint)

  for (let i = currentIndex; i >= 0; i--) {
    const bp = BREAKPOINTS_ORDER[i]

    if (value[bp] !== undefined) {
      return value[bp]
    }
  }

  return fallback
}

const computedColumns = computed(() => getResponsiveValue(props.columns, 1))
const computedGap = computed(() => getResponsiveValue(props.gap, 12))

const gridStyles = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${computedColumns.value}, 1fr)`,
  gap: `${computedGap.value}px`,
}))

const buttonWrapperRef = ref<HTMLElement | null>(null)
const visibleCount = ref(props.batchSize)
const hasExpanded = ref(false)

const displayedItems = computed(() => {
  if (!props.items) return []
  if (props.async) return props.items
  if (!props.expandable) return props.items

  return props.items.slice(0, visibleCount.value)
})

const isExpanded = computed(() => {
  if (props.async) return props.endReached
  if (!props.items) return false

  return visibleCount.value >= props.items.length
})

const showToggle = computed(() => {
  if (props.async) {
    if (!props.endReached || props.loading) return true
    if (hasExpanded.value) return true

    return false
  }

  if (!props.items || !props.expandable) return false

  return props.items.length > props.batchSize
})

watch(() => props.batchSize, (newBatchSize) => {
  visibleCount.value = newBatchSize
})

const getItemKey = (item: T, index: number): string | number => {
  if (props.keyField && item && typeof item === 'object') {
    return item[props.keyField] as string | number
  }

  return index
}

const scrollToButton = () => {
  const el = buttonWrapperRef.value

  if (!el) return

  el.scrollIntoView({ behavior: 'smooth', block: 'end' })
}

const toggle = () => {
  if (props.async) {
    if (isExpanded.value) {
      hasExpanded.value = false
      emit('collapse')
      setTimeout(scrollToButton, 50)
    } else {
      hasExpanded.value = true
      emit('load-more')
    }

    return
  }

  if (!props.items) return

  if (isExpanded.value) {
    visibleCount.value = props.batchSize
    setTimeout(scrollToButton, 50)

    return
  }

  visibleCount.value += props.batchSize
}
</script>

<style scoped lang="scss">
.ui-grid-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.grid {
  width: 100%;

  :deep(.expand-enter-active) {
    transition: opacity 0.3s ease, transform 0.3s ease;
  }

  :deep(.expand-enter-from) {
    opacity: 0;
    transform: translateY(16px);
  }
}

.button-wrapper {
  margin-top: var(--space-24);
}

.toggle-button {
  :deep(.n-button__content) {
    color: var(--color-text);
  }
}
</style>
