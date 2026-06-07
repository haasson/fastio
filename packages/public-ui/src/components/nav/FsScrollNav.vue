<template>
  <div class="scroll-nav-root" :class="[`scroll-nav-${size}`, `scroll-nav-${overflow}`]">
    <Transition name="fade">
      <div v-if="overflow === 'scroll' && showLeft" class="fade-edge fade-left" />
    </Transition>

    <div ref="trackRef" class="scroll-nav-track">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="scroll-nav-item"
        :class="{ 'is-active': modelValue === item.id }"
        @click="onItemClick(item.id)"
      >
        <span>{{ item.label }}</span>
        <span v-if="item.count !== undefined" class="item-count">{{ item.count }}</span>
      </button>
    </div>

    <Transition name="fade">
      <div v-if="overflow === 'scroll' && showRight" class="fade-edge fade-right" />
    </Transition>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

type NavItem = {
  id: string | number
  label: string
  count?: number
}

type Props = {
  items: NavItem[]
  modelValue?: string | number
  size?: 'sm' | 'md'
  overflow?: 'scroll' | 'wrap'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  overflow: 'scroll',
})

const emit = defineEmits<{
  'update:modelValue': [id: string | number]
}>()

const trackRef = ref<HTMLElement | null>(null)
const showLeft = ref(false)
const showRight = ref(false)

const EDGE_THRESHOLD = 8

const updateFades = () => {
  const el = trackRef.value
  if (!el) return
  showLeft.value = el.scrollLeft > EDGE_THRESHOLD
  showRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE_THRESHOLD
}

let ro: ResizeObserver | null = null

onMounted(() => {
  const el = trackRef.value
  if (!el) return
  updateFades()
  el.addEventListener('scroll', updateFades, { passive: true })
  ro = new ResizeObserver(updateFades)
  ro.observe(el)
})

onUnmounted(() => {
  const el = trackRef.value
  if (el) el.removeEventListener('scroll', updateFades)
  ro?.disconnect()
})

const onItemClick = (id: string | number) => {
  emit('update:modelValue', id)
}

watch(() => props.modelValue, (id) => {
  if (!trackRef.value || id === undefined) return
  const idx = props.items.findIndex(item => item.id === id)
  const btn = trackRef.value.children[idx] as HTMLElement | undefined
  btn?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
})
</script>
<style scoped lang="scss">
.scroll-nav-root {
  position: relative;
  display: flex;
  align-items: center;
}

.scroll-nav-track {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
  scroll-snap-type: x mandatory;
  flex: 1;

  &::-webkit-scrollbar {
    display: none;
  }
}

.scroll-nav-wrap .scroll-nav-track {
  overflow-x: visible;
  flex-wrap: wrap;
  scroll-snap-type: none;
}

// ─── Items ───────────────────────────────────────────────────────────────────

.scroll-nav-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  scroll-snap-align: start;
  padding: 10px 14px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  transition: color 0.15s, border-color 0.15s;
  cursor: pointer;
  flex-shrink: 0;

  &.is-active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  &:hover:not(.is-active) {
    color: var(--color-text);
  }
}

.scroll-nav-sm .scroll-nav-item {
  padding: 8px 10px;
  font-size: 12px;
}

// ─── Count badge ─────────────────────────────────────────────────────────────

.item-count {
  font-size: 11px;
  color: var(--color-text-secondary);
}

// ─── Fade edges ──────────────────────────────────────────────────────────────

.fade-edge {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 48px;
  pointer-events: none;
  z-index: 1;
}

.fade-left {
  left: -1px;
  background: linear-gradient(to right, var(--color-surface), transparent);
}

.fade-right {
  right: -1px;
  background: linear-gradient(to left, var(--color-surface), transparent);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
