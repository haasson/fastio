<template>
  <!-- Bottom: vaul-vue со свайпом -->
  <template v-if="effectiveSide === 'bottom'">
    <DrawerRoot :open="modelValue" handle-only @update:open="emit('update:modelValue', $event)">
      <DrawerPortal>
        <DrawerOverlay class="drawer-overlay" />
        <DrawerContent class="drawer-bottom" :style="bottomSizeStyle">
          <DrawerHandle class="handle" />

          <div v-if="title || $slots['header-action']" class="header">
            <DrawerTitle v-if="title" class="title">{{ title }}</DrawerTitle>
            <DrawerTitle v-else class="visually-hidden">Диалоговое окно</DrawerTitle>
            <slot name="header-action" />
          </div>
          <DrawerTitle v-else class="visually-hidden">Диалоговое окно</DrawerTitle>

          <div class="scroll-area">
            <slot />
          </div>

          <div v-if="$slots.footer" class="footer">
            <slot name="footer" />
          </div>
        </DrawerContent>
      </DrawerPortal>
    </DrawerRoot>
  </template>

  <!-- Right: reka-ui -->
  <template v-else>
    <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
      <DialogPortal>
        <DialogOverlay class="drawer-overlay" />
        <DialogContent
          class="drawer-right"
          :style="rightSizeStyle"
          @pointer-down-outside="closeOnOverlay ? undefined : (e: Event) => e.preventDefault()"
          @interact-outside="closeOnOverlay ? undefined : (e: Event) => e.preventDefault()"
        >
          <div v-if="title || closable" class="header">
            <DialogTitle v-if="title" class="title">{{ title }}</DialogTitle>
            <div v-else />
            <DialogClose v-if="closable" class="close-btn" aria-label="Закрыть">
              <X :size="18" />
            </DialogClose>
          </div>

          <slot />

          <div v-if="$slots.footer" class="footer">
            <slot name="footer" />
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </template>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { DrawerRoot, DrawerPortal, DrawerOverlay, DrawerContent, DrawerTitle, DrawerHandle } from 'vaul-vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogClose,
} from 'reka-ui'
import { X } from 'lucide-vue-next'
import { useModalHistory } from '../../composables/useModalHistory'

type Props = {
  modelValue: boolean
  title?: string
  side?: 'bottom' | 'right'
  size?: 'sm' | 'md' | 'lg' | 'full'
  closable?: boolean
  closeOnOverlay?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'lg',
  closable: true,
  closeOnOverlay: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const effectiveSide = computed(() => props.side ?? 'bottom')

// Только bottom-sheet — back-жест ожидается только на мобильной шторке,
// для side='right' (desktop sidebar) нативный back не нужен.
useModalHistory(
  () => effectiveSide.value === 'bottom' && props.modelValue,
  () => emit('update:modelValue', false),
)

// reka-ui (под vaul-vue) на время открытия модального слоя ставит
// document.body.style.pointerEvents = 'none' (DismissableLayer) и снимает только при
// размонтировании слоя. Размонтирование gating'ится закрывающей анимацией, а на мобилке
// transitionend ненадёжен → блокировка «залипает» на пару секунд, и первый тап по странице
// глохнет. Принудительно снимаем блокировку при закрытии (если шторка не открылась заново).
const releaseBodyPointerLock = () => {
  if (typeof document === 'undefined' || props.modelValue) return
  if (document.body.style.pointerEvents === 'none') document.body.style.pointerEvents = ''
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) return
    requestAnimationFrame(releaseBodyPointerLock)
    window.setTimeout(releaseBodyPointerLock, 550)
  },
)

const bottomSizeStyle = computed(() => {
  const map: Record<string, string> = { sm: '40vh', md: '60vh', lg: '90vh', full: '100vh' }
  return { maxHeight: map[props.size] }
})

const rightSizeStyle = computed(() => {
  const map: Record<string, string> = { sm: '320px', md: '480px', lg: '640px', full: '100vw' }
  return { width: map[props.size] }
})
</script>

<style scoped lang="scss">
@use '../../styles/mixins' as *;

.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: var(--z-overlay, 300);
}

.drawer-bottom {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color-surface);
  border-radius: var(--radius-card) var(--radius-card) 0 0;
  padding: 0 20px 0;
  @include safe-area-bottom(20px);
  z-index: var(--z-modal, 400);
  max-height: 90vh;
  outline: none;
  font-family: var(--font-family);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.drawer-right {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  background: var(--color-surface);
  z-index: var(--z-modal, 400);
  overflow-y: auto;
  padding: 24px;
  @include safe-area-top(24px);
  @include safe-area-right(24px);
  outline: none;
  font-family: var(--font-family);

  &[data-state='open'] { animation: slide-left 0.25s cubic-bezier(0.32, 0.72, 0, 1); }
  &[data-state='closed'] { animation: slide-right 0.2s ease; }
}

@keyframes slide-left {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes slide-right {
  from { transform: translateX(0); }
  to { transform: translateX(100%); }
}

.handle {
  position: relative;
  width: 36px;
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  margin: 12px auto 16px;
  flex-shrink: 0;
  cursor: grab;
  touch-action: none;

  // pointer-хендлеры DrawerHandle висят на этом элементе → расширяем кликабельную/
  // таскабельную зону невидимым псевдоэлементом во всю ширину шторки и в высоту
  // (визуальная таблетка остаётся 36×4 по центру). -50vw клипается overflow:hidden.
  &::after {
    content: '';
    position: absolute;
    top: -28px;
    bottom: -28px;
    left: -50vw;
    right: -50vw;
  }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
  font-family: var(--heading-font-family, var(--font-family));
}

.close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: var(--radius-btn);
  flex-shrink: 0;
  transition: background 0.15s;

  &:hover { background: var(--surface-hover); }
}

.footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 16px 0 0;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
