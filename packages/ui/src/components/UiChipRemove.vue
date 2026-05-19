<template>
  <button
    type="button"
    class="ui-chip-remove"
    :class="`ui-chip-remove--${variant}`"
    :title="title"
    :aria-label="title"
    @click.stop="emit('click', $event)"
  >
    <UiIcon name="close" :size="size" />
  </button>
</template>

<script setup lang="ts">
import { UiIcon } from '@fastio/icons'

type Props = {
  /**
   * `default` — прозрачный фон, hover красный (для chip/inline).
   * `overlay` — полупрозрачный чёрный фон, белая иконка (для × поверх фото).
   */
  variant?: 'default' | 'overlay'
  size?: number
  title?: string
}

withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 12,
  title: 'Удалить',
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<style scoped lang="scss">
.ui-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.ui-chip-remove--default {
  background: transparent;
  color: var(--color-text-secondary);

  &:hover {
    background: var(--color-error-light);
    color: var(--color-error);
  }
}

.ui-chip-remove--overlay {
  // Overlay над фото: background и color литералами — в dark theme
  // var(--color-white) резолвится в #1c1c1e (почти чёрный), что делает × невидимым
  // на полупрозрачном чёрном background. Inverse overlay должен быть тёмным в обеих темах.
  /* stylelint-disable scale-unlimited/declaration-strict-value, color-no-hex */
  background: rgba(0, 0, 0, 0.5);
  color: #fff;

  &:hover {
    background: rgba(0, 0, 0, 0.75);
  }
  /* stylelint-enable scale-unlimited/declaration-strict-value, color-no-hex */
}
</style>
