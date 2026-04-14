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

    <ModuleToggleIssuesModal
      :issues="toggleIssues"
      :can-proceed="!!pendingToggleKey"
      @confirm="onIssuesConfirm"
      @close="onIssuesDismiss"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { UiSectionHeader, UiDivider, useMessage } from '@fastio/ui'
import { useTenantStore } from '~/stores/tenant'
import { useModules, useModuleConfigs } from '~/composables/plan/useModules'
import { usePlans } from '~/composables/plan/usePlans'
import type { ModuleKey } from '~/config/modules'
import { useDatabase } from '~/composables/data/useDatabase'
import { checkModuleDisable, type ToggleIssue } from '~/utils/moduleToggleChecks'
import ModuleCard from '~/components/settings/ModuleCard.vue'
import ModuleToggleIssuesModal from '~/components/settings/ModuleToggleIssuesModal.vue'

const tenantStore = useTenantStore()
const api = useDatabase()
const modules = useModules()
const { configs } = useModuleConfigs()
const { getPlanLabel } = usePlans()
const { warning } = useMessage()

const toggleIssues = ref<ToggleIssue[]>([])
const pendingToggleKey = ref<ModuleKey | null>(null)

const moduleList = computed(() => configs.value.map((cfg) => ({
  ...cfg,
  state: modules[cfg.key].value,
})),
)

const availableModules = computed(() => moduleList.value.filter((m) => !m.state.locked))
const lockedModules = computed(() => moduleList.value.filter((m) => m.state.locked))

const doToggle = async (key: ModuleKey, val: boolean) => {
  await tenantStore.update({
    modules: { ...tenantStore.tenant!.modules, [key]: val },
  }).catch(() => warning('Не удалось сохранить изменения'))
}

const toggle = async (key: ModuleKey, val: boolean) => {
  if (!tenantStore.tenant) return

  // Enabling — no checks needed
  if (val) {
    await doToggle(key, true)

    return
  }

  const issues = await checkModuleDisable(key, tenantStore.tenant.id, tenantStore.tenant.siteLayout, api)

  const blockers = issues.filter((i) => i.severity === 'blocker')
  const warnings = issues.filter((i) => i.severity === 'warning')

  // Hard blockers — show modal, can't proceed
  if (blockers.length) {
    toggleIssues.value = issues
    pendingToggleKey.value = null

    return
  }

  // Warnings only — show modal with confirm
  if (warnings.length) {
    toggleIssues.value = issues
    pendingToggleKey.value = key

    return
  }

  await doToggle(key, false)
}

const onIssuesConfirm = async () => {
  if (pendingToggleKey.value) {
    await doToggle(pendingToggleKey.value, false)
  }
  toggleIssues.value = []
  pendingToggleKey.value = null
}

const onIssuesDismiss = () => {
  toggleIssues.value = []
  pendingToggleKey.value = null
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;
@use '@fastio/styles/mixins/media-queries' as *;

.modules-root {
  @include flex-col(var(--space-20));
}

.modules-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-12);

  @include mq-m {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
