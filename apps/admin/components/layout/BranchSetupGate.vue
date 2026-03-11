<template>
  <div class="gate-root">
    <UiCard class="gate-card">
      <UiIcon name="mapPin" :size="48" class="icon" />
      <UiTitle size="h3">Добавьте первый филиал</UiTitle>
      <UiText size="small" class="desc">
        Перед началом работы нужно добавить хотя бы один филиал —
        к нему будут привязываться заказы.
      </UiText>
      <UiButton
        v-if="canManageTeam"
        type="primary"
        icon="plus"
        @click="drawerOpen = true"
      >
        Добавить филиал
      </UiButton>
      <UiText v-else size="small" class="hint">
        Обратитесь к администратору для настройки филиала
      </UiText>
    </UiCard>

    <BranchDrawer
      v-if="canManageTeam"
      v-model="drawerOpen"
      :branch="null"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { UiTitle, UiText, UiButton, UiIcon, UiCard } from '@fastio/ui'
import { usePermissions } from '~/composables/auth/usePermissions'
import { useBranchStore } from '~/stores/branch'
import type { BranchFormData } from '@fastio/shared'
import BranchDrawer from '~/components/settings/BranchDrawer.vue'

const branchStore = useBranchStore()
const { canManageTeam } = usePermissions()

const drawerOpen = ref(false)

const handleSave = async (data: BranchFormData) => {
  await branchStore.add(data)
  drawerOpen.value = false
}
</script>

<style scoped lang="scss">
.gate-root {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 100%;
  padding: 40px 16px;
}

.gate-card {
  align-items: center;
  gap: 16px;
  text-align: center;
  max-width: 380px;
}

.icon {
  color: var(--color-primary);
}

.desc {
  color: var(--color-text-secondary);
}

.hint {
  color: var(--color-text-tertiary);
}
</style>
