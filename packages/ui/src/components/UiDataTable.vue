<template>
  <n-data-table class="data-table" v-bind="$attrs" />
</template>

<script setup lang="ts">
import { NDataTable } from 'naive-ui'

defineOptions({
  inheritAttrs: false,
})
</script>

