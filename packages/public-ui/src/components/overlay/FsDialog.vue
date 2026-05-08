<template>
  <FsDrawer
    v-if="isMobile"
    :model-value="modelValue"
    :title="title"
    :closable="closable"
    :size="drawerSize"
    side="bottom"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <slot />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </FsDrawer>

  <DialogRoot v-else :open="modelValue" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" :style="{ zIndex: zIndexOverlay }" />
      <DialogContent
        class="dialog-content"
        :class="`dialog-${size}`"
        :style="{ maxWidth, zIndex: zIndexContent }"
        @pointer-down-outside="closeOnOverlay ? undefined : (e: Event) => e.preventDefault()"
        @interact-outside="closeOnOverlay ? undefined : (e: Event) => e.preventDefault()"
      >
        <div v-if="title" class="header">
          <DialogTitle class="title">{{ title }}</DialogTitle>
          <DialogClose v-if="closable" class="close-btn" aria-label="Закрыть">
            <X :size="18" />
          </DialogClose>
        </div>
        <DialogClose v-else-if="closable" class="close-btn close-btn-no-title" aria-label="Закрыть">
          <X :size="18" />
        </DialogClose>

        <DialogDescription v-if="description" class="desc">
          {{ description }}
        </DialogDescription>

        <slot />

        <div v-if="$slots.footer" class="footer">
          <slot name="footer" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'
import { X } from 'lucide-vue-next'
import FsDrawer from './FsDrawer.vue'
import { useModalHistory } from '../../composables/useModalHistory'

type Props = {
  modelValue: boolean
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg'
  drawerSize?: 'sm' | 'md' | 'lg' | 'full'
  closable?: boolean
  closeOnOverlay?: boolean
  forceDialog?: boolean
  /**
   * Уровень в стеке диалогов. Нужен когда один диалог открыт поверх другого
   * (confirm поверх picker и т.п.) — ставит z-index выше базового.
   */
  level?: number
  /**
   * Не добавлять собственную запись в browser history. Для блокирующих imperative-диалогов
   * (ConfirmDialog), открытых поверх обычного модала — иначе два pushState/back пересекаются
   * и юзера уносит на предыдущий URL. На back закроется верхний модал из LIFO-стека.
   */
  silentHistory?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  drawerSize: 'lg',
  closable: true,
  closeOnOverlay: true,
  forceDialog: false,
  level: 0,
  silentHistory: false,
})

// ИНВАРИАНТ: STACK_STEP > (z-modal - z-overlay), иначе overlay следующего уровня
// не покроет content предыдущего и верхний content окажется «дырой» в нижнем overlay.
// База: z-overlay=300, z-modal=400, разница=100. Шаг 200 = с запасом.
const STACK_STEP = 200
const stackOffset = computed(() => props.level * STACK_STEP)
const zIndexOverlay = computed(() => `calc(var(--z-overlay, 300) + ${stackOffset.value})`)
const zIndexContent = computed(() => `calc(var(--z-modal, 400) + ${stackOffset.value})`)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const _isMobile = useMediaQuery('(max-width: 767px)')
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const isMobile = computed(() => !props.forceDialog && mounted.value && _isMobile.value)

const sizeMap: Record<string, string> = { sm: '400px', md: '560px', lg: '720px' }
const maxWidth = computed(() => sizeMap[props.size])

function onOpenChange(value: boolean) {
  emit('update:modelValue', value)
}

// На мобиле рендерится FsDrawer — у него свой useModalHistory.
// Guard !_isMobile здесь нужен, чтобы не было двойного push в history при mobile-режиме.
useModalHistory(
  () => mounted.value && (!_isMobile.value || props.forceDialog) && props.modelValue,
  () => emit('update:modelValue', false),
  { silent: props.silentHistory },
)
</script>

<style scoped lang="scss">
@use '../../styles/mixins' as *;

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: var(--z-overlay, 300);

  &[data-state='open'] { animation: overlay-in 0.2s ease; }
  &[data-state='closed'] { animation: overlay-out 0.15s ease; }
}

@keyframes overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes overlay-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

.dialog-content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--color-surface);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card-md, var(--shadow-card));
  padding: 16px;
  z-index: var(--z-modal, 400);
  width: calc(100% - 32px);
  outline: none;
  font-family: var(--font-family);

  @include md {
    width: 100%;
    padding: 24px;
  }

  &[data-state='open'] { animation: dialog-in 0.2s ease; }
  &[data-state='closed'] { animation: dialog-out 0.15s ease; }
}

@keyframes dialog-in {
  from { opacity: 0; transform: translate(-50%, calc(-50% - 8px)); }
  to { opacity: 1; transform: translate(-50%, -50%); }
}

@keyframes dialog-out {
  from { opacity: 1; transform: translate(-50%, -50%); }
  to { opacity: 0; transform: translate(-50%, calc(-50% - 8px)); }
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
}

.desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0 0 16px;
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
  &:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
}

.close-btn-no-title {
  position: absolute;
  top: 16px;
  right: 16px;
}

.footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 24px;
}
</style>
