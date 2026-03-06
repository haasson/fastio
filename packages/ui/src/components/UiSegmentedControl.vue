<template>
  <div class="segmented-control" :class="[`size-${computedSize}`, { 'full-width': fullWidth }]">
    <div class="background" :style="backgroundStyle" />

    <div
      v-for="(item, index) in items"
      :key="item.value || index"
      class="item"
      :class="{
        'active': isSelected(item.value || index),
        'has-tag': !!item.tag
      }"
      ref="itemRefs"
      @click="selectItem(item.value || index)"
    >
      <UiIcon v-if="item.icon" :name="item.icon" class="item-icon" />
      <span v-if="item.label" class="label">{{ item.label }}</span>
      <span v-if="item.tag" class="tag">{{ item.tag }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch, type CSSProperties } from 'vue'
import useResponsiveSize from '../composables/useResponsiveSize'
import { throttle } from '../utils/throttle'
import type { Size, ResponsiveSizeMap } from '../types/responsive'
import type { IconName } from '../icons'
import UiIcon from './UiIcon.vue'

export type SegmentedControlItem = {
  label?: string
  icon?: IconName
  value?: string | number
  tag?: string
}

type Props = {
  items: SegmentedControlItem[]
  modelValue?: string | number | null
  size?: Size
  responsive?: ResponsiveSizeMap
  fullWidth?: boolean
}

type Emits = {
  'update:modelValue': [value: string | number]
}

const props = withDefaults(defineProps<Props>(), {
  size: 'small',
})

const computedSize = useResponsiveSize({
  size: props.size,
  responsive: props.responsive,
})

const emit = defineEmits<Emits>()

const itemRefs = ref<HTMLElement[]>([])
const backgroundStyle = ref<CSSProperties>({})
const resizeObserver = ref<ResizeObserver | null>(null)
const hasInteracted = ref(false)

const selectedValue = computed({
  get: () => props.modelValue,
  set: (value: string | number | null) => {
    if (value !== null) {
      emit('update:modelValue', value)
    }
  },
})

const isSelected = (value: string | number): boolean => {
  return selectedValue.value === value
}

const selectItem = (value: string | number) => {
  hasInteracted.value = true
  selectedValue.value = value
  updateBackground()
}

const updateBackground = async () => {
  await nextTick()

  const activeIndex = props.items.findIndex((item) => {
    return isSelected(item.value || props.items.indexOf(item))
  })

  if (activeIndex === -1 || !itemRefs.value[activeIndex]) {
    backgroundStyle.value = { opacity: '0' }

    return
  }

  const activeElement = itemRefs.value[activeIndex]

  backgroundStyle.value = {
    transform: `translateX(${activeElement.offsetLeft}px)`,
    width: `${activeElement.offsetWidth}px`,
    opacity: '1',
    transition: hasInteracted.value ? undefined : 'none',
  }
}

const throttledUpdateBackground = throttle(updateBackground, 100)

onMounted(() => {
  updateBackground()

  if (itemRefs.value[0]?.parentElement) {
    resizeObserver.value = new ResizeObserver(throttledUpdateBackground)
    resizeObserver.value.observe(itemRefs.value[0].parentElement)
  }
})

onUnmounted(() => {
  resizeObserver.value?.disconnect()
})

watch(() => props.modelValue, () => {
  updateBackground()
})

watch(() => props.items, () => {
  nextTick(updateBackground)
}, { deep: true })
</script>

<style scoped lang="scss">
@use '../styles/mixins/typography' as *;

.segmented-control {
  position: relative;
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-white);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:where(.full-width) {
    display: flex;
    width: 100%;
  }

  &:where(.size-tiny) {
    height: 24px;
    border-radius: 6px;

    .background {
      border-radius: 4px;
    }

    .item {
      padding: 4px 8px;
      font-size: 12px;

      &.has-tag {
        padding-right: 6px;
      }
    }

    .tag {
      @include secondary-font(10);

      padding: 2px 3px;
    }
  }

  &:where(.size-small) {
    height: 32px;
    border-radius: 6px;

    .background {
      border-radius: 4px;
    }

    .item {
      padding: 6px 10px;
      font-size: 12px;

      &.has-tag {
        padding-right: 6px;
      }
    }

    .tag {
      @include secondary-font(10);

      padding: 2px 3px;
    }
  }

  &:where(.size-medium) {
    height: 40px;
    border-radius: 8px;

    .background {
      border-radius: 6px;
    }

    .item {
      padding: 8px 12px;
      font-size: 14px;

      &.has-tag {
        padding-right: 8px;
      }
    }

    .tag {
      @include secondary-font(12);

      padding: 3px 4px;
    }
  }

  &:where(.size-large) {
    height: 48px;
    border-radius: 12px;

    .background {
      border-radius: 10px;
    }

    .item {
      padding: 10px 16px;
      font-size: 16px;

      &.has-tag {
        padding-right: 12px;
      }
    }

    .tag {
      @include secondary-font(14);

      padding: 5px 7px;
    }
  }

  .background {
    position: absolute;
    top: 2px;
    left: -2px;
    z-index: 1;
    height: calc(100% - 4px);
    background: var(--color-primary);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  }

  .item {
    position: relative;
    z-index: 2;
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: 6px;
    color: var(--color-text-hint);
    font-weight: 700;
    cursor: pointer;
    user-select: none;
    transition: all 0.2s ease;

    &:hover {
      background: var(--color-primary-light);
    }

    &.active {
      color: var(--color-white);

      &:hover {
        background: transparent;
      }

      .tag {
        background: var(--color-white);
        color: var(--color-title);
      }
    }

    &:not(.active) .tag {
      background: var(--color-primary);
      color: var(--color-white);
    }
  }

  .item-icon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
  }

  .label {
    white-space: nowrap;
  }

  .tag {
    flex-shrink: 0;
    border-radius: 100px;
    font-weight: 700;
    white-space: nowrap;
    transition: background-color 0.2s ease;
  }
}
</style>
