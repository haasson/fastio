<template>
  <NTree
    :data="naiveData"
    :checked-keys="modelValue"
    :default-expanded-keys="defaultExpandedKeys"
    cascade
    checkable
    block-node
    :render-suffix="renderSuffix"
    class="ui-tree"
    @update:checked-keys="$emit('update:modelValue', $event as string[])"
  />
</template>

<script setup lang="ts">
import { h, computed } from 'vue'
import { NTree } from 'naive-ui'
import type { TreeOption } from 'naive-ui'

export type UiTreeNode = {
  key: string
  label: string
  hint?: string
  children?: UiTreeNode[]
}

type NaiveNode = TreeOption & { hint?: string }

const props = withDefaults(defineProps<{
  modelValue: string[]
  data: UiTreeNode[]
  defaultExpandedKeys?: string[]
}>(), {
  defaultExpandedKeys: () => [],
})

defineEmits<{
  'update:modelValue': [keys: string[]]
}>()

const mapNode = (node: UiTreeNode): NaiveNode => ({
  key: node.key,
  label: node.label,
  hint: node.hint,
  children: node.children?.map(mapNode),
})

const naiveData = computed(() => props.data.map(mapNode))

const renderSuffix = ({ option, checked }: { option: NaiveNode; checked: boolean }) => {
  if (!checked || !option.hint) return null

  return h('span', {
    style: 'font-size: var(--font-size-xs); color: var(--color-text-secondary); padding-right: var(--space-4);',
  }, option.hint)
}
</script>
