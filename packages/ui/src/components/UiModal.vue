<template>
  <client-only>
    <n-modal
      ref="nModalRef"
      :show="isShown"
      :auto-focus="false"
      :trap-focus="false"
      :z-index="zIndex"
      class="modal-root"
      :style="{ width: `min(${width}px, calc(100vw - 24px))` }"
      v-bind="$attrs"
    >
      <div class="modal-wrapper">
        <div v-if="closable" class="close-icon" @click="close">
          <ui-icon name="close" :size="{ s: 16, l: 24 }" color="currentColor" />
        </div>

        <div class="header">
          <h4 v-if="effectiveTitle" class="title">{{ effectiveTitle }}</h4>
          <slot name="header" />
        </div>

        <div class="content">
          <slot />
        </div>

        <div v-if="$slots.footer || actions" class="footer">
          <slot name="footer">
            <div v-if="actions" class="modal-actions" :class="{ 'modal-actions--column': stackedActions, 'modal-actions--reverse': reverseActions }">
              <ui-button
                v-for="(action, index) in actions"
                :key="index"
                :responsive="{ s: 'medium', l: 'large' }"
                :type="(action.type as any)"
                :disabled="action.disabled"
                :loading="action.loading"
                v-bind="action.buttonProps"
                @click="handleActionClick(action)"
              >
                {{ action.text }}
              </ui-button>
            </div>
          </slot>
        </div>

        <transition name="loading-fade">
          <div v-if="loading" class="loading-overlay">
            <div class="spinner" />
          </div>
        </transition>
      </div>
    </n-modal>
  </client-only>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { NModal } from 'naive-ui'
import UiIcon from './UiIcon.vue'
import UiButton from './UiButton.vue'
import ClientOnly from './internal/ClientOnly.vue'
import { modalManager } from '../composables/useModals'
import { layerManager } from '../utils/layers'

export type ModalAction = {
  text: string
  type?: 'primary' | 'default' | 'error' | 'warning' | 'success' | 'text'
  disabled?: boolean
  loading?: boolean
  actionType: 'confirm' | 'decline'
  buttonProps?: Record<string, any>
}

export type UiModalProps = {
  name?: string
  modelValue?: boolean
  title?: string
  width?: number
  actions?: ModalAction[]
  stackedActions?: boolean
  reverseActions?: boolean
  closable?: boolean
  loading?: boolean
  onConfirm?: () => boolean | void | Promise<boolean | void>
  onDecline?: () => boolean | void | Promise<boolean | void>
}

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<UiModalProps>(), {
  width: 512,
  stackedActions: false,
  closable: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  open: []
  close: []
}>()

const isVModel = computed(() => !props.name)

const modalController = modalManager.createController()
const nModalRef = ref<InstanceType<typeof NModal> | null>(null)
const zIndex = ref<number | undefined>(undefined)

const isShown = computed(() =>
  isVModel.value ? (props.modelValue ?? false) : modalController.isShown.value,
)

function getModalContainer(): HTMLElement | null {
  return nModalRef.value?.containerRef as HTMLElement | null
}

watch(isShown, (shown) => {
  if (shown) {
    zIndex.value = layerManager.push()
    requestAnimationFrame(() => {
      const modalContainer = getModalContainer()

      if (modalContainer) {
        modalContainer.addEventListener('click', stopPropagation)
        modalContainer.addEventListener('pointerdown', stopPropagation)
        modalContainer.addEventListener('mousedown', stopPropagation)
      }
    })
    emit('open')
  } else {
    const modalContainer = getModalContainer()

    if (modalContainer) {
      modalContainer.removeEventListener('click', stopPropagation)
      modalContainer.removeEventListener('pointerdown', stopPropagation)
      modalContainer.removeEventListener('mousedown', stopPropagation)
    }
    layerManager.pop()
    zIndex.value = undefined
    emit('close')
  }
})

function stopPropagation(e: Event) {
  e.stopImmediatePropagation()
}

onMounted(() => {
  if (props.name) modalManager.register(props.name, modalController)
})

onUnmounted(() => {
  if (props.name) modalManager.unregister(props.name)
})

const effectiveTitle = computed(() => {
  if (!props.name) return props.title
  const config = modalManager.getModalConfig(props.name)
  return (config?.title as string | undefined) ?? props.title
})

const close = () => {
  if (isVModel.value) {
    emit('update:modelValue', false)
  } else {
    modalController.decline()
  }
}

const handleActionClick = async (action: ModalAction) => {
  if (action.actionType === 'confirm') {
    if (props.onConfirm) {
      const result = await props.onConfirm()
      if (result === false) return
    }
    if (isVModel.value) emit('update:modelValue', false)
    else modalController.confirm()
  } else {
    if (props.onDecline) {
      const result = await props.onDecline()
      if (result === false) return
    }
    if (isVModel.value) emit('update:modelValue', false)
    else modalController.decline()
  }
}
</script>

<style scoped lang="scss">
@use '../styles/mixins' as *;

.modal-wrapper {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  position: relative;
  padding: 24px 16px;
  background-color: var(--color-white);
  border-radius: 16px;
  overflow: hidden;

  @include mq-l {
    padding: 40px 32px;
    border-radius: 24px;
  }
}

.title {
  @include secondary-font(24);

  margin: 0;
  line-height: 1.3;

  @include mq-l {
    @include secondary-font(32);
  }
}

.close-icon {
  position: absolute;
  top: 16px;
  right: 16px;
  color: var(--grey-300);
  cursor: pointer;
  transition: color 0.3s;

  @include mq-l {
    top: 24px;
    right: 24px;
  }

  &:hover {
    color: var(--grey-500);
  }
}

.content {
  margin-top: 16px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;

  @include mq-l {
    margin-top: 24px;
  }
}

.footer {
  margin-top: 24px;

  @include mq-l {
    margin-top: 32px;
  }
}

.modal-actions {
  display: flex;
  gap: 8px;

  @include mq-l {
    gap: 12px;
  }

  :deep(.n-button) {
    flex: 1;
    width: 0;
    min-width: 0;
  }

  &--column {
    flex-direction: column;

    :deep(.n-button) {
      flex: none;
      width: 100%;
    }
  }

  &--reverse {
    flex-direction: row-reverse;
  }

  &--column#{&}--reverse {
    flex-direction: column-reverse;
  }
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10;
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
  background: rgba(255, 255, 255, 0.7);
}

.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.25s ease;
}

.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--grey-200);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
