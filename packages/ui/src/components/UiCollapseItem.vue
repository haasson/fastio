<template>
  <n-collapse-item v-bind="$attrs" :name="name" class="collapse-item-root">
    <template #header>
      <slot v-if="$slots.header" name="header" />
      <ui-text v-else :weight="600" size="small">
        {{ $attrs.title }}
      </ui-text>
    </template>

    <template v-if="$slots['header-extra']" #header-extra>
      <slot name="header-extra" />
    </template>

    <slot />
  </n-collapse-item>
</template>

<script setup lang="ts">
import { NCollapseItem } from 'naive-ui'
import UiText from './UiText.vue'

defineProps<{
  name: string | number
}>()
</script>
