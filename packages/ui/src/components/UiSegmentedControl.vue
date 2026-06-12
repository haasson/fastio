<template>
  <n-tabs
    :value="modelValue ?? undefined"
    type="segment"
    :size="size"
    animated
    :class="['segmented-control-root', `is-${size}`]"
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

/* Высота рейла = стандартной высоте контролов Naive (как у кнопок/инпутов/селектов),
   чтобы сегмент не выбивался из размерного ряда. Вертикальный паддинг убран —
   высоту задаёт рейл, а не метрики шрифта. */
.segmented-control-root.is-small :deep(.n-tabs-rail) {
  height: 28px;
}

.segmented-control-root.is-medium :deep(.n-tabs-rail) {
  height: 34px;
}

.segmented-control-root.is-large :deep(.n-tabs-rail) {
  height: 40px;
}

.segmented-control-root :deep(.n-tabs-tab) {
  padding: 0 var(--space-16);
}
</style>
