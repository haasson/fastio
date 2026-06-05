<template>
  <div class="tabs-layout" :class="{ 'with-sidebar': $slots.sidebar, 'full-height': fullHeight }">
    <div class="tabs-row">
      <UiTabs
        v-if="!hideSingle || tabs.length > 1"
        :model-value="activeTab"
        :tabs="tabs"
        @update:model-value="goToTab"
      />
      <slot name="extra" />
    </div>

    <div class="content-layout">
      <div class="main-col">
        <UiCard v-if="card" size="large">
          <NuxtPage />
        </UiCard>
        <NuxtPage v-else />
      </div>
      <aside v-if="$slots.sidebar" class="sidebar-col">
        <slot name="sidebar" />
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from '#imports'
import { UiTabs, UiCard } from '@fastio/ui'
import type { IconName } from '@fastio/icons'

type Tab = { value: string; label: string; icon?: IconName; count?: number; attrs?: Record<string, string> }

const props = defineProps<{
  tabs: Tab[]
  basePath: string
  card?: boolean
  fullHeight?: boolean
  hideSingle?: boolean
  rootTab?: string
}>()

const route = useRoute()
const router = useRouter()

const activeTab = computed(() => {
  const seg = route.path.split('/').at(-1) ?? ''
  const valid = props.tabs.map((t) => t.value)

  return valid.includes(seg) ? seg : props.tabs[0]?.value ?? ''
})

const goToTab = (tab: string | number) => {
  const path = props.rootTab && props.rootTab === String(tab)
    ? props.basePath
    : `${props.basePath}/${tab}`

  router.push(path)
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.tabs-layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.tabs-row {
  display: flex;
  align-items: center;
  gap: var(--space-12);

  :slotted(*) {
    margin-left: auto;
  }
}

.content-layout {
  display: contents;
}

.with-sidebar .content-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-16);
  flex: 1;
  min-height: 0;

  @include mq-l {
    grid-template-columns: 1fr 360px;
  }
}

.sidebar-col {
  overflow-y: auto;
  min-height: 0;
}

.full-height {
  flex: 1;
  min-height: 0;
  overflow: hidden;

  .content-layout {
    flex: 1;
    min-height: 0;
  }

  .main-col {
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

}
</style>
