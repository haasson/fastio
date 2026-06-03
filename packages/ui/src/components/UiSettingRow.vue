<template>
  <div class="setting-row" :class="`align-${align}`">
    <div class="content">
      <div class="label">
        <span>{{ label }}</span>
        <UiInfoTip v-if="$slots.help"><slot name="help" /></UiInfoTip>
        <UiInfoTip v-else-if="help" :content="help" />
      </div>
      <div v-if="hint" class="hint">{{ hint }}</div>
    </div>
    <div class="control">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import UiInfoTip from './UiInfoTip.vue'

// Строка настройки: слева лейбл + опц. hint + опц. «?»; справа — контрол (дефолтный слот).
// align=end (дефолт) прижимает контрол вправо; align=start — компактный кластер слева.
withDefaults(defineProps<{
  label: string
  hint?: string
  help?: string
  align?: 'start' | 'end'
}>(), {
  align: 'end',
})
</script>

<style scoped lang="scss">
.setting-row {
  display: flex;
  align-items: center;
  gap: var(--space-12);

  &.align-end {
    justify-content: space-between;
  }

  // Компактный локальный тоггл: свитч слева, лейбл справа (как чекбокс).
  &.align-start {
    gap: var(--space-8);

    .control {
      order: -1;
    }
  }
}

.content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  font-size: var(--font-size-md);
  color: var(--color-text);
  line-height: var(--line-height-base);
}

.hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}

.control {
  flex-shrink: 0;
}
</style>
