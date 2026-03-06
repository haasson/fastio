<template>
  <n-collapse-item v-bind="$attrs" :name="name" class="collapse-item-root">
    <template #header>
      <slot v-if="$slots.header" name="header" />
      <ui-title v-else size="h5" class="collapse-item-title" responsive>
        {{ $attrs.title }}
      </ui-title>
    </template>

    <template #header-extra>
      <div class="collapse-icon">
        <ui-icon
          v-show="!isExpanded"
          :name="isChevronIcon ? 'chevronRound' : 'plusRound'"
          :size="iconSize"
          :color="iconBg"
        />
        <ui-icon
          v-show="isExpanded"
          :name="isChevronIcon ? 'chevronRound' : 'minusRound'"
          :size="iconSize"
          :flip-y="isChevronIcon"
          :color="iconBg"
        />
      </div>
      <slot name="header-extra" />
    </template>

    <ui-text v-if="!empty" size="small" class="content">
      <slot />
    </ui-text>
    <slot v-else />
  </n-collapse-item>
</template>

<script setup lang="ts">
import { NCollapseItem } from 'naive-ui'
import { computed, inject, type Ref } from 'vue'
import UiIcon from './UiIcon.vue'
import UiText from './UiText.vue'
import UiTitle from './UiTitle.vue'

interface Props {
  name: string | number
  icon?: 'chevron'
  empty?: boolean
  iconSize?: number | Record<string, number>
  iconBg?: string
  iconFg?: string
}

const props = withDefaults(defineProps<Props>(), {
  iconSize: () => ({ l: 40 }),
  iconBg: 'blue-100',
  iconFg: 'blue-500',
})

const expandedNames = inject('expandedNames') as Ref<(string | number)[]>

const isExpanded = computed(() => {
  if (!expandedNames?.value) return false

  return expandedNames.value.includes(props.name)
})

const isChevronIcon = computed(() => props.icon === 'chevron')
</script>

<style scoped lang="scss">
.collapse-icon {
  display: flex;
}
</style>
