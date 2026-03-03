<template>
  <ui-select
    v-if="shouldShowSelect"
    v-model:value="activeTab"
    :options="tabs"
    :size="props.size"
    :responsive="props.responsive"
    placeholder="Выберите вариант"
  />

  <ui-space v-else :wrap="true" :size="12">
    <ui-tag
      v-for="tab in tabs"
      :key="tab.value"
      :size="props.size"
      :responsive="props.responsive"
      round
      :empty="activeTab !== tab.value"
      :type="activeTab === tab.value ? 'primary' : 'default'"
      class="tabs-item"
      @click="handleTabClick(tab.value)"
    >
      <ui-icon v-if="tab.icon" :name="tab.icon" :size="14" class="tab-icon" />
      {{ tab.label }}
    </ui-tag>
  </ui-space>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiSpace from './UiSpace.vue'
import UiTag from './UiTag.vue'
import UiSelect from './UiSelect.vue'
import UiIcon from './UiIcon.vue'
import useBreakpoints from '../composables/useBreakpoints'
import type { Size, ResponsiveSizeMap } from '../types/responsive'
import type { IconName } from '../icons'

type TabItem = {
  value: string | number
  label: string
  icon?: IconName
}

type Props = {
  tabs: TabItem[]
  preventCompact?: boolean
  size?: Size
  responsive?: ResponsiveSizeMap
}

const props = withDefaults(defineProps<Props>(), {
  preventCompact: false,
  size: 'medium',
})

const activeTab = defineModel<string | number>({ required: true })

const { m } = useBreakpoints()

const shouldShowSelect = computed(() => !props.preventCompact && !m.value)

const handleTabClick = (value: string | number) => {
  activeTab.value = value
}
</script>

<style scoped lang="scss">
.tabs-item {
  cursor: pointer;
  font-weight: 700;

  &:deep(.n-tag__content) {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  &:deep(.n-tag__border) {
    border-width: 2px;
    border-color: var(--grey-900);
  }

  &:not(.tag--empty):deep(.n-tag__border) {
    border-color: transparent;
  }
}
</style>
