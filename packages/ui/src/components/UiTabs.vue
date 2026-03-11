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
      hoverable
      :empty="activeTab !== tab.value"
      :type="tab.type ?? 'primary'"
      class="tabs-item"
      @click="handleTabClick(tab.value)"
    >
      <ui-icon v-if="tab.icon" :name="tab.icon" :size="14" class="tab-icon" />
      {{ tab.label }}
      <ui-counter
        v-if="tab.count !== undefined"
        :value="tab.count"
        :type="tab.type ?? 'primary'"
        :filled="activeTab === tab.value"
        size="tiny"
        class="tab-count"
      />
    </ui-tag>
  </ui-space>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiSpace from './UiSpace.vue'
import UiTag from './UiTag.vue'
import UiSelect from './UiSelect.vue'
import { UiIcon } from '@fastio/icons'
import UiCounter from './UiCounter.vue'
import { useBreakpoints } from '@fastio/kit'
import type { Size, ResponsiveSizeMap } from '@fastio/kit'
import type { IconName } from '@fastio/icons'

type TagType = 'default' | 'primary' | 'success' | 'warning' | 'error'

type TabItem = {
  value: string | number
  label: string
  icon?: IconName
  count?: number
  type?: TagType
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
}

.tab-count {
  margin-left: 6px;
}
</style>
