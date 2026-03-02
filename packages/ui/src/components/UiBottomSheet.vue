<template>
  <drawer-root v-model:open="isOpen" handle-only>
    <drawer-portal>
      <drawer-overlay class="drawer-overlay" :style="overlayStyle" />
      <drawer-content
        ref="contentRef"
        class="drawer-content"
        :style="contentStyle"
        :aria-describedby="undefined"
        tabindex="-1"
        @open-auto-focus="handleOpenAutoFocus"
        @close-auto-focus.prevent
      >
        <drawer-handle class="drawer-handle" />

        <drawer-title v-if="title" as-child>
          <ui-title size="h3" class="title"><span v-html="title" /></ui-title>
        </drawer-title>
        <drawer-title v-else class="visually-hidden">
          Диалоговое окно
        </drawer-title>

        <div class="bottom-sheet-wrapper">
          <div v-if="$slots.header" class="header">
            <slot name="header" />
          </div>

          <div class="content" :class="contentClass">
            <slot />
          </div>
        </div>
      </drawer-content>
    </drawer-portal>
  </drawer-root>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted, watch } from 'vue'
import { DrawerRoot, DrawerPortal, DrawerOverlay, DrawerContent, DrawerTitle, DrawerHandle } from 'vaul-vue'
import UiTitle from './UiTitle.vue'
import { layerManager } from '../utils/layers'
import { modalManager } from '../composables/useModals'

export type UiBottomSheetProps = {
  modelValue?: boolean
  title?: string
  contentClass?: string
  vh?: number
  fullWidth?: boolean
}

const props = withDefaults(defineProps<UiBottomSheetProps>(), {
  modelValue: false,
  title: '',
  contentClass: '',
  vh: 70,
  fullWidth: false,
})

const zIndex = ref<number | undefined>(undefined)

const overlayStyle = computed(() => ({
  zIndex: zIndex.value,
}))

const contentStyle = computed(() => ({
  '--bottom-sheet-max-height': `${props.vh}vh`,
  '--bottom-sheet-max-width': props.fullWidth ? 'none' : '640px',
  'zIndex': zIndex.value ? zIndex.value + 1 : undefined,
}))

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'opened': []
  'closed': []
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const contentRef = ref<{ $el: HTMLElement } | null>(null)

function handleOpenAutoFocus(event: Event) {
  event.preventDefault()
  contentRef.value?.$el?.focus()
}

function updateBodyScroll(open: boolean) {
  if (typeof document === 'undefined') return

  if (open) {
    document.documentElement.style.overflow = 'hidden'
  } else {
    const hasOpenModals = modalManager.getOpenModals().length > 0

    if (!hasOpenModals) {
      document.documentElement.style.overflow = ''
    }
  }
}

watch(isOpen, (newValue, oldValue) => {
  if (oldValue === undefined && !newValue) return

  updateBodyScroll(newValue)

  if (newValue && !oldValue) {
    zIndex.value = layerManager.push()
    emit('opened')
  } else if (!newValue && oldValue) {
    layerManager.pop()
    zIndex.value = undefined
    emit('closed')
  }
}, { immediate: true })

onUnmounted(() => {
  if (isOpen.value) {
    updateBodyScroll(false)
  }
})
</script>

<style scoped lang="scss">
@use '../styles/mixins/safe-area' as *;

.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 2100;
  background: rgba(0, 0, 0, 0.2);
}

.drawer-content {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2101;
  display: flex;
  flex-direction: column;
  max-width: var(--bottom-sheet-max-width, 640px);
  max-height: var(--bottom-sheet-max-height, 70vh);
  margin: 0 auto;
  background: white;
  border-radius: 16px 16px 0 0;
}

.drawer-handle {
  position: relative;
  flex-shrink: 0;
  width: 68px;
  height: 3px;
  margin: 20px auto;
  background: var(--grey-300);
  border-radius: 16px;

  &::before {
    content: '';
    position: absolute;
    top: -40px;
    right: -50vw;
    bottom: -12px;
    left: -50vw;
  }
}

.bottom-sheet-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0 16px 16px;

  @include safe-area-bottom(16px);
}

.content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.header {
  position: sticky;
  top: 0;
  z-index: 10;
  margin-bottom: 12px;
  background: var(--color-white);
}

.title {
  padding: 0 16px;
  margin-bottom: 12px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
</style>
