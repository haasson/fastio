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
@use '../styles/mixins/media-queries' as *;

.data-table {
  &:deep(.n-data-table-wrapper) {
    border-radius: 12px;
  }

  &:deep(.n-data-table-thead .n-data-table-tr:first-child) {
    .n-data-table-th:first-child {
      border-top-left-radius: 12px;
    }

    .n-data-table-th:last-child {
      border-top-right-radius: 12px;
    }
  }

  &:deep(.n-data-table-tbody .n-data-table-tr:last-child) {
    .n-data-table-td:first-child {
      border-bottom-left-radius: 12px;
    }

    .n-data-table-td:last-child {
      border-bottom-right-radius: 12px;
    }
  }

  &:deep(.n-data-table-th),
  &:deep(.n-data-table-td) {
    font-size: 13px;
    line-height: 1.4;
  }

  &:deep(.n-data-table-thead),
  &:deep(.n-data-table-th) {
    background-color: transparent;
  }

  // Фиксированные колонки: нужен непрозрачный фон чтобы не просвечивали при скролле
  &:deep(.n-data-table-th--fixed-left),
  &:deep(.n-data-table-th--fixed-right),
  &:deep(.n-data-table-td--fixed-left),
  &:deep(.n-data-table-td--fixed-right) {
    background-color: var(--color-bg-card);
  }

  &:deep(.n-data-table-th),
  &:deep(.n-data-table-td) {
    border-right: 1px solid var(--n-border-color);

    &:last-child {
      border-right: none;
    }
  }
}
</style>
