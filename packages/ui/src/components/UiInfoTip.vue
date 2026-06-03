<template>
  <UiPopover
    trigger="click"
    no-sheet
    inline-trigger
    :width="width"
  >
    <template #trigger>
      <span class="info-tip-trigger" @click.stop>
        <UiIcon name="help" :size="16" class="info-tip-icon" />
      </span>
    </template>
    <div class="info-tip-body">
      <slot>{{ content }}</slot>
    </div>
  </UiPopover>
</template>

<script setup lang="ts">
import { UiIcon } from '@fastio/icons'
import UiPopover from './UiPopover.vue'

// «?»-подсказка у лейбла поля/настройки. Простой текст — через :content, богатый — через слот.
withDefaults(defineProps<{
  content?: string
  width?: number
}>(), {
  width: 260,
})
</script>

<style scoped lang="scss">
.info-tip-trigger {
  display: inline-flex;
  align-items: center;
}

.info-tip-icon {
  color: var(--color-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s;

  &:hover {
    color: var(--color-primary);
  }
}

// Размер задаём здесь, а не в теме Naive: scoped-стиль долетает до телепортнутого
// контента поповера (элемент несёт scope-атрибут), тема Popover.fontSize — нет.
.info-tip-body {
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text);
}
</style>
