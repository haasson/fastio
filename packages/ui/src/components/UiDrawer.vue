<template>
  <client-only>
    <n-drawer
      :show="modelValue"
      :width="effectiveWidth"
      placement="right"
      display-directive="show"
      :z-index="zIndex"
      :auto-focus="false"
      :trap-focus="false"
      @update:show="onUpdateShow"
    >
      <n-drawer-content
        :closable="false"
        :native-scrollbar="false"
      >
        <template #header>
          <div class="drawer-header">
            <span class="drawer-title">{{ title }}</span>
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
}

export type UiDrawerProps = {
  modelValue: boolean
  title?: string
  width?: number | string
  closable?: boolean
  actions?: DrawerAction[]
  onConfirm?: () => boolean | void | Promise<boolean | void>
  onDecline?: () => boolean | void | Promise<boolean | void>
}

const props = withDefaults(defineProps<UiDrawerProps>(), {
  width: 800,
  closable: true,
})

const { m: isDesktop } = useBreakpoints()
const effectiveWidth = computed(() => isDesktop.value ? props.width : '100%')

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'opened': []
  'closed': []
}>()

const zIndex = ref<number | undefined>(undefined)

watch(() => props.modelValue, (shown) => {
  if (shown) {
    zIndex.value = layerManager.push()
    emit('opened')
  } else {
    layerManager.pop()
    zIndex.value = undefined
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
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drawer-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-title);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: color 0.3s;

  &:hover {
    color: var(--color-text-hint);
  }
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0;
}
</style>
