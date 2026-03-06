<template>
  <n-collapse
    v-model:expanded-names="expandedNames"
    :class="{ 'collapse--clean': layout === 'clean' }"
    @update:expanded-names="handleExpandedNamesUpdate"
    v-bind="$attrs"
  >
    <slot />
  </n-collapse>
</template>

<script setup lang="ts">
import { ref, provide } from 'vue'
import { NCollapse, type CollapseProps } from 'naive-ui'

type CollapseLayout = 'default' | 'clean'

interface Props extends /* @vue-ignore */ CollapseProps {
  expandedNames?: (string | number)[]
  layout?: CollapseLayout
}

const props = withDefaults(defineProps<Props>(), {
  expandedNames: () => [],
  layout: 'default',
})

const expandedNames = ref(props.expandedNames)

provide('expandedNames', expandedNames)

const handleExpandedNamesUpdate = (newExpandedNames: (string | number)[]) => {
  expandedNames.value = newExpandedNames
}
</script>

