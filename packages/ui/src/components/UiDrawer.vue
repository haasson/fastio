<template>
  <client-only>
    <n-drawer
      :show="modelValue"
      :width="effectiveWidth"
      :placement="placement"
      :show-mask="showMask"
      :mask-closable="maskClosable"
      :to="to"
      display-directive="show"
      :z-index="effectiveZIndex"
      :auto-focus="false"
      :trap-focus="false"
      @update:show="onUpdateShow"
    >
      <n-drawer-content
        :closable="false"
        :native-scrollbar="false"
      >
        <template #header>
          <div class="drawer-header" :class="`drawer-header--align-${headerAlign}`">
            <div class="drawer-title">
              <slot name="title">{{ title }}</slot>
            </div>
            <div class="header-right">
              <slot name="header-actions" />
              <div v-if="closable" class="close-btn" @click="onUpdateShow(false)">
                <ui-icon name="close" :size="20" color="currentColor" />
              </div>
            </div>
          </div>
        </template>
        <slot />
        <template v-if="$slots.footer || actions" #footer>
          <div class="footer">
            <slot name="footer">
              <UiButton
                v-for="(action, index) in actions"
                :key="index"
                v-bind="action.attrs"
                :type="(action.type as any)"
                :disabled="action.disabled"
                :loading="action.loading"
                @click="handleActionClick(action)"
              >
                {{ action.text }}
              </UiButton>
            </slot>
          </div>
        </template>
      </n-drawer-content>
    </n-drawer>
  </client-only>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { NDrawer, NDrawerContent } from 'naive-ui'
import ClientOnly from './internal/ClientOnly.vue'
import { UiIcon } from '@fastio/icons'
import UiButton from './UiButton.vue'
import { layerManager } from '@fastio/kit'
import { useBreakpoints } from '@fastio/kit'

export type DrawerAction = {
  text: string
  type?: 'primary' | 'default' | 'error' | 'warning' | 'success' | 'text'
  disabled?: boolean
  loading?: boolean
  actionType: 'confirm' | 'decline'
  attrs?: Record<string, string>
}

export type UiDrawerProps = {
  modelValue: boolean
  title?: string
  width?: number | string
  closable?: boolean
  placement?: 'left' | 'right'
  /** Куда телепортировать drawer (CSS-селектор / элемент). По умолчанию body. */
  to?: string | HTMLElement
  /** Показывать ли затемняющую маску. true | 'transparent' | false. */
  showMask?: boolean | 'transparent'
  /** Закрывать ли по клику вне панели. */
  maskClosable?: boolean
  /** Фиксированный z-index; если задан — layerManager не используется. */
  zIndex?: number
  /** Выравнивание содержимого шапки по оси Y. `start` нужен, если title — многострочный блок. */
  headerAlign?: 'center' | 'start'
  actions?: DrawerAction[]
  onConfirm?: () => boolean | void | Promise<boolean | void>
  onDecline?: () => boolean | void | Promise<boolean | void>
}

const props = withDefaults(defineProps<UiDrawerProps>(), {
  width: 800,
  closable: true,
  placement: 'right',
  showMask: true,
  maskClosable: true,
  headerAlign: 'center',
})

const { m: isDesktop } = useBreakpoints()
const effectiveWidth = computed(() => isDesktop.value ? props.width : '100%')

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'opened': []
  'closed': []
}>()

const managedZIndex = ref<number | undefined>(undefined)
const effectiveZIndex = computed(() => props.zIndex ?? managedZIndex.value)

watch(() => props.modelValue, (shown) => {
  if (shown) {
    // Если зафиксировали zIndex снаружи — layerManager не трогаем (он управляет стеком модалок).
    if (props.zIndex === undefined) managedZIndex.value = layerManager.push()
    emit('opened')
  } else {
    if (props.zIndex === undefined) {
      layerManager.pop()
      managedZIndex.value = undefined
    }
    emit('closed')
  }
})

function onUpdateShow(value: boolean) {
  emit('update:modelValue', value)
}

async function handleActionClick(action: DrawerAction) {
  if (action.actionType === 'confirm') {
    if (props.onConfirm) {
      const result = await props.onConfirm()
      if (result === false) return
    }
    emit('update:modelValue', false)
  } else {
    if (props.onDecline) {
      const result = await props.onDecline()
      if (result === false) return
    }
    emit('update:modelValue', false)
  }
}
</script>

<style scoped lang="scss">
.drawer-header {
  display: flex;
  justify-content: space-between;
  width: 100%;

  &--align-center {
    align-items: center;
  }

  &--align-start {
    align-items: flex-start;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.drawer-title {
  display: flex;
  align-items: center;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-title);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color 0.3s;

  &:hover {
    color: var(--color-text-hint);
  }
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-8);
  padding: 0;
}
</style>
