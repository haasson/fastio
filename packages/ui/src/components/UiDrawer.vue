<template>
  <client-only>
    <n-drawer
      :show="modelValue"
      :width="effectiveWidth"
      placement="right"
      display-directive="show"
      :z-index="zIndex"
      @update:show="onUpdateShow"
    >
      <n-drawer-content
        :title="title"
        :closable="closable"
        :native-scrollbar="false"
      >
        <slot />
        <template v-if="$slots.footer" #footer>
          <div class="footer">
            <slot name="footer" />
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
import { layerManager } from '../utils/layers'
import useBreakpoints from '../composables/useBreakpoints'

export type UiDrawerProps = {
  modelValue: boolean
  title?: string
  width?: number | string
  closable?: boolean
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
</script>

<style scoped lang="scss">
.drawer-root {
  /* всё через naive-ui */
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
}
</style>
