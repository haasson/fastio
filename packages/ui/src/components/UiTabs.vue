<template>
  <ui-select
    v-if="shouldShowSelect"
    v-model:value="activeTab"
    :options="tabs"
    :size="props.size"
    :responsive="props.responsive"
    placeholder="Выберите вариант"
  />

  <div v-else-if="props.variant === 'line'" class="tabs-line">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      class="tab-line-item"
      :class="{ active: activeTab === tab.value }"
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
    </button>
  </div>

  <ui-space v-else-if="props.variant === 'pill'" :wrap="true" :size="12">
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
  variant?: 'line' | 'pill'
  preventCompact?: boolean
  size?: Size
  responsive?: ResponsiveSizeMap
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'line',
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

.tabs-line {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--n-border-color, #e0e0e6);
}

.tab-line-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  color: var(--n-text-color-3, #999);
  font-size: 14px;
  font-family: inherit;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;

  &:hover {
    color: var(--n-text-color, #333);
  }

  &.active {
    color: var(--color-primary, #18a058);
    border-bottom-color: var(--color-primary, #18a058);
  }

  .tab-count {
    margin-left: 2px;
  }
}
</style>
