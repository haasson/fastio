<template>
  <n-tabs
    :value="modelValue ?? undefined"
    type="segment"
    :size="size"
    animated
    class="segmented-control-root"
    @update:value="emit('update:modelValue', $event)"
  >
    <n-tab
      v-for="item in items"
      :key="item.value"
      :name="item.value"
      :tab="item.label"
    />
  </n-tabs>
</template>

<script setup lang="ts">
import { NTabs, NTab } from 'naive-ui'

export type SegmentedControlItem = {
  label: string
  value: string | number
}

type Props = {
  items: SegmentedControlItem[]
  modelValue?: string | number | null
  size?: 'small' | 'medium' | 'large'
}

withDefaults(defineProps<Props>(), {
  size: 'medium',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()
</script>

<style scoped lang="scss">
.segmented-control-root {
  width: fit-content;
}

.segmented-control-root :deep(.n-tabs-tab) {
  padding: var(--space-8) var(--space-16);
}
</style>
