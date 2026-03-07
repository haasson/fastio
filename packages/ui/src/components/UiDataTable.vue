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
  :deep(.n-data-table-td),
  :deep(.n-data-table-th) {
    font-size: 13px;
  }
}
</style>
