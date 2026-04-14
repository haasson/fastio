<template>
  <div
    v-if="props.variant === 'line'"
    class="tabs-scroll-wrapper"
    :class="{ 'shadow-left': canScrollLeft, 'shadow-right': canScrollRight }"
  >
    <div ref="scrollContainer" class="tabs-line" @scroll="updateScrollState">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        v-bind="tab.attrs"
        class="tab-line-item"
        :class="{ active: activeTab === tab.value }"
        @click="handleTabClick(tab.value)"
      >
        <ui-icon v-if="tab.icon" :name="tab.icon" :size="14" class="tab-icon" />
        {{ tab.label }}
        <ui-counter
          v-if="tab.count !== undefined"
          :value="tab.count"
          :type="tab.type ?? 'primary'"
          :filled="activeTab === tab.value"
          size="tiny"
          class="tab-count"
        />
      </button>
    </div>
  </div>

  <ui-select
    v-else-if="shouldShowSelect"
    v-model:value="activeTab"
    :options="tabs"
    :size="props.size"
    :responsive="props.responsive"
    placeholder="Выберите вариант"
  />

  <ui-space v-else-if="props.variant === 'pill'" :wrap="true" :size="12">
    <ui-tag
      v-for="tab in tabs"
      :key="tab.value"
      v-bind="tab.attrs"
      :size="props.size"
      :responsive="props.responsive"
      round
      hoverable
      :empty="activeTab !== tab.value"
      :type="tab.type ?? 'primary'"
      class="tabs-item"
      @click="handleTabClick(tab.value)"
    >
      <ui-icon v-if="tab.icon" :name="tab.icon" :size="14" class="tab-icon" />
      {{ tab.label }}
      <ui-counter
        v-if="tab.count !== undefined"
        :value="tab.count"
        :type="tab.type ?? 'primary'"
        :filled="activeTab === tab.value"
        size="tiny"
        class="tab-count"
      />
    </ui-tag>
  </ui-space>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import UiSpace from './UiSpace.vue'
import UiTag from './UiTag.vue'
import UiSelect from './UiSelect.vue'
import { UiIcon } from '@fastio/icons'
import UiCounter from './UiCounter.vue'
import { useBreakpoints } from '@fastio/kit'
import type { Size, ResponsiveSizeMap } from '@fastio/kit'
import type { IconName } from '@fastio/icons'

type TagType = 'default' | 'primary' | 'success' | 'warning' | 'error'

type TabItem = {
  value: string | number
  label: string
  icon?: IconName
  count?: number
  type?: TagType
  attrs?: Record<string, string>
}

type Props = {
  tabs: TabItem[]
  variant?: 'line' | 'pill'
  size?: Size
  responsive?: ResponsiveSizeMap
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'line',
  size: 'medium',
})

const activeTab = defineModel<string | number>({ required: true })

const { m } = useBreakpoints()
const shouldShowSelect = computed(() => props.variant === 'pill' && !m.value)

const scrollContainer = ref<HTMLElement>()
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

const updateScrollState = () => {
  const el = scrollContainer.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 0
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}

let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  nextTick(updateScrollState)
  if (scrollContainer.value) {
    resizeObserver = new ResizeObserver(updateScrollState)
    resizeObserver.observe(scrollContainer.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

watch(() => props.tabs, () => nextTick(updateScrollState))

const scrollActiveIntoView = () => {
  const el = scrollContainer.value
  if (!el) return
  const active = el.querySelector('.active') as HTMLElement
  if (!active) return

  const left = active.offsetLeft - el.offsetLeft
  const right = left + active.offsetWidth
  const scrollLeft = el.scrollLeft
  const visible = el.clientWidth

  if (left < scrollLeft) {
    el.scrollTo({ left: left - 16, behavior: 'smooth' })
  } else if (right > scrollLeft + visible) {
    el.scrollTo({ left: right - visible + 16, behavior: 'smooth' })
  }
}

const handleTabClick = (value: string | number) => {
  activeTab.value = value
  nextTick(scrollActiveIntoView)
}
</script>

<style scoped lang="scss">
.tabs-scroll-wrapper {
  position: relative;
  overflow: hidden;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 32px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 1;
  }

  &::before {
    left: 0;
    background: linear-gradient(to right, var(--color-bg-page), transparent);
  }

  &::after {
    right: 0;
    background: linear-gradient(to left, var(--color-bg-page), transparent);
  }

  &.shadow-left::before {
    opacity: 1;
  }

  &.shadow-right::after {
    opacity: 1;
  }
}

.tabs-item {
  cursor: pointer;
  flex-shrink: 0;
}

.tab-count {
  margin-left: 6px;
}

.tabs-line {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--n-border-color, #e0e0e6);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.tab-line-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  color: var(--n-text-color-3, #999);
  font-size: 14px;
  font-family: inherit;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    color: var(--n-text-color, #333);
  }

  &.active {
    color: var(--color-primary, #18a058);
    border-bottom-color: var(--color-primary, #18a058);
  }

  .tab-count {
    margin-left: 2px;
  }
}
</style>
