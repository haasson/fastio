<template>
  <n-divider
    class="divider"
    :class="{ vertical }"
    :vertical="vertical"
    :dashed="dashed"
    :title-placement="titlePlacement"
  >
    <slot v-if="$slots.default" />
  </n-divider>
</template>

<script setup lang="ts">
import { NDivider } from 'naive-ui'

type Props = {
  vertical?: boolean
  dashed?: boolean
  titlePlacement?: 'left' | 'center' | 'right'
}

withDefaults(defineProps<Props>(), {
  vertical: false,
  dashed: false,
  titlePlacement: 'center',
})
</script>

<style scoped lang="scss">
.divider {
  :deep(.n-divider__line) {
    height: 2px;
    background-color: var(--color-border);
  }

  :deep(.n-divider__title) {
    margin: 0;
    padding-inline: 24px;
    font-size: 16px;
    font-weight: 400;
  }
}
</style>
