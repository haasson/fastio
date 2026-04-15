<template>
  <n-data-table class="data-table" v-bind="$attrs" />
</template>

<script setup lang="ts">
import { NDataTable } from 'naive-ui'

defineOptions({
  inheritAttrs: false,
})
</script>

<style scoped lang="scss">
.data-table {
  // Внешняя обводка — как у карточки
  :deep(.n-data-table-wrapper) {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-8);
    overflow: hidden;
  }

  :deep(.n-data-table-td),
  :deep(.n-data-table-th) {
    font-size: var(--font-size-base);
  }

  // Заголовок: выделенный фон + чёткая нижняя граница
  :deep(.n-data-table-th) {
    background-color: var(--color-bg-subtle) !important;
    border-bottom: 1px solid var(--color-border) !important;
    color: var(--color-text-hint);
    font-weight: var(--font-weight-semibold);
  }

  // Ячейки тела: лёгкий разделитель
  :deep(.n-data-table-td) {
    border-bottom: 1px solid var(--color-border-light) !important;
  }

  // Последняя строка без нижней границы
  :deep(.n-data-table-tr:last-child .n-data-table-td) {
    border-bottom: none !important;
  }

  // Ховер строки
  :deep(.n-data-table-tr--hover .n-data-table-td),
  :deep(.n-data-table-tr:hover .n-data-table-td) {
    background-color: var(--color-bg-hover) !important;
  }
}
</style>
