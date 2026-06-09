<template>
  <div class="branches-root">
    <UiAlert v-if="isVenueMode" type="info" icon="sparkles">
      Хотите открыть несколько точек? На тарифе Pro можно добавить любое количество филиалов и управлять ими отдельно.
      <NuxtLink to="/account/billing" class="upsell-link">Сменить тариф</NuxtLink>
    </UiAlert>
    <UiAlert v-else-if="branchLimitReached" type="info" icon="mapPin">
      На вашем тарифе доступно {{ maxBranches }} {{ branchLimitLabel }}. Обновите тариф для добавления новых точек.
    </UiAlert>

    <UiSkeleton v-if="loading" text :repeat="3" />

    <!-- Single-branch (venueMode): редактируем единственный филиал прямо на странице, без табов -->
    <template v-else-if="isVenueMode">
      <BranchAddressBlock v-if="primaryBranch" ref="addressBlockRef" :branch="primaryBranch" />
      <TenantContactsBlock ref="contactsBlockRef" />
    </template>

    <!-- Multi-branch: Список / Настройки через табы -->
    <TabsLayout
      v-else
      :tabs="tabs"
      base-path="/branches"
      root-tab="index"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { UiSkeleton, UiAlert } from '@fastio/ui'
import { usePageTitle } from '~/shared/composables/usePageTitle'
import { useTenantStore } from '~/shared/stores/tenant'
import { useBranchStore } from '~/shared/stores/branch'
import { useBranchLimit } from '~/shared/plan/useBranchLimit'
import { useGate } from '~/shared/plan/useGate'
import BranchAddressBlock from '~/features/settings/components/BranchAddressBlock.vue'
import TenantContactsBlock from '~/features/settings/components/TenantContactsBlock.vue'
import TabsLayout from '~/shared/ui/components/TabsLayout.vue'
import { useRegisterPageForm } from '~/shared/ui/composables/usePageForm'
import { useUnsavedGuard } from '~/shared/ui/composables/useUnsavedGuard'
import type { FormHandle } from '~/shared/ui/composables/useEditableForm'

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const { branches, loading } = storeToRefs(branchStore)
const gate = useGate()

const { branchLimitReached, maxBranches, branchLimitLabel } = useBranchLimit()
const isVenueMode = computed(() => !gate.branches.value.enabled)

usePageTitle(computed(() => isVenueMode.value ? 'Заведение' : 'Филиалы'))

const primaryBranch = computed(() => branches.value[0] ?? null)

const tabs = computed(() => [
  { value: 'index', label: 'Список' },
  { value: 'settings', label: 'Настройки' },
])

// venue-mode: контакты + адрес единственного филиала редактируются прямо здесь.
// shallowRef обязателен: внутри handle лежат ComputedRef, которые ref() развернёт и сломает.
const contactsBlockRef = shallowRef<{ handle: FormHandle } | null>(null)
const addressBlockRef = shallowRef<{ handle: FormHandle } | null>(null)

const blockHandles = computed<FormHandle[]>(
  () => [contactsBlockRef.value?.handle, addressBlockRef.value?.handle].filter(Boolean) as FormHandle[],
)

const pageHandle: FormHandle = {
  isDirty: computed(() => blockHandles.value.some((f) => f.isDirty.value)),
  saving: computed(() => blockHandles.value.some((f) => f.saving.value)),
  submit: async () => {
    for (const f of blockHandles.value) {
      if (f.isDirty.value) await f.submit()
    }
  },
  reset: () => blockHandles.value.forEach((f) => f.reset()),
}

useRegisterPageForm(pageHandle)
useUnsavedGuard(pageHandle.isDirty)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.branches-root {
  @include flex-col(var(--space-16));
}

.upsell-link {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
  margin-left: var(--space-4);

  &:hover { text-decoration: underline; }
}
</style>
