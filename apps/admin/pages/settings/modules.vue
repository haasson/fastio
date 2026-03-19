<template>
  <div class="modules-root">
    <template v-if="availableModules.length">
      <UiSectionHeader :title="lockedModules.length ? 'Доступно на вашем тарифе' : 'Модули'" />
      <div class="modules-grid">
        <ModuleCard
          v-for="mod in availableModules"
          :key="mod.key"
          :name="mod.name"
          :description="mod.description"
          :icon="mod.icon"
          :active="mod.state.active"
          :locked="false"
          @toggle="toggle(mod.key, $event)"
        />
      </div>
      <UiDivider v-if="lockedModules.length" />
    </template>

    <template v-if="lockedModules.length">
      <UiSectionHeader title="Недоступно на вашем тарифе" />
      <div class="modules-grid">
        <ModuleCard
          v-for="mod in lockedModules"
          :key="mod.key"
          :name="mod.name"
          :description="mod.description"
          :icon="mod.icon"
          :active="mod.state.active"
          :locked="true"
          :plan-label="getPlanLabel(mod.requiredPlan)"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiSectionHeader, UiDivider, useMessage } from '@fastio/ui'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useModules, useModuleConfigs } from '~/composables/plan/useModules'
import { usePlans } from '~/composables/plan/usePlans'
import type { ModuleKey } from '~/config/modules'
import { useDatabase } from '~/composables/data/useDatabase'
import ModuleCard from '~/components/settings/ModuleCard.vue'

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const api = useDatabase()
const modules = useModules()
const { configs } = useModuleConfigs()
const { getPlanLabel } = usePlans()
const { warning } = useMessage()

const moduleList = computed(() => configs.value.map((cfg) => ({
  ...cfg,
  state: modules[cfg.key].value,
})),
)

const availableModules = computed(() => moduleList.value.filter((m) => !m.state.locked))
const lockedModules = computed(() => moduleList.value.filter((m) => m.state.locked))

const toggle = async (key: ModuleKey, val: boolean) => {
  if (!tenantStore.tenant) return

  if (key === 'branches' && !val && branchStore.branches.length > 1) {
    warning(`Архивируйте все филиалы кроме одного, чтобы отключить этот модуль (активных: ${branchStore.branches.length})`)

    return
  }

  if (key === 'dineIn' && !val) {
    const tables = await api.tables.list(tenantStore.tenant.id)
    const openCount = tables.filter((t) => t.isOpen).length

    if (openCount > 0) {
      warning(`Закройте все столы перед отключением модуля (открытых: ${openCount})`)

      return
    }
  }

  await tenantStore.update({
    modules: { ...tenantStore.tenant.modules, [key]: val },
  }).catch(() => warning('Не удалось сохранить изменения'))
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.modules-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.modules-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;

  @include mq-m {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
