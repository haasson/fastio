<template>
  <div class="branches-root">
    <UiAlert v-if="isVenueMode" type="info" icon="sparkles">
      Хотите открыть несколько точек? На тарифе Pro можно добавить любое количество филиалов и управлять ими отдельно.
      <NuxtLink to="/account/billing" class="upsell-link">Сменить тариф</NuxtLink>
    </UiAlert>
    <UiAlert v-else-if="branchLimitReached" type="info" icon="mapPin">
      На вашем тарифе доступно {{ maxBranches }} {{ branchLimitLabel }}. Обновите тариф для добавления новых точек.
    </UiAlert>

    <div v-if="!isVenueMode" class="header-actions">
      <UiButton
        type="primary"
        icon="plus"
        size="small"
        :disabled="branchLimitReached"
        :title="branchLimitReached ? 'Лимит филиалов на вашем тарифе' : undefined"
        @click="openAdd"
      >Добавить</UiButton>
    </div>

    <UiSkeleton v-if="loading" text :repeat="3" />

    <template v-else-if="branches.length">
      <div v-for="branch in branches" :key="branch.id" class="branch-row">
        <div class="branch-info">
          <div class="branch-name-wrap">
            <UiText size="medium" class="branch-name">{{ branch.name }}</UiText>
            <UiTag v-if="!branch.isActive" type="warning" size="small">Неактивен</UiTag>
          </div>
          <UiText v-if="branch.address" size="tiny" class="branch-address">{{ branch.address }}</UiText>
          <UiText v-if="branch.phone" size="tiny" class="branch-phone">{{ branch.phone }}</UiText>
          <div v-if="deliveryEnabled && hasAnyZones && branchHasNoZones(branch.id)" class="branch-warning">
            <span class="branch-warning-text">Нет зон доставки — доставка не работает.</span>
            <NuxtLink to="/orders/delivery" class="branch-warning-link">Настроить зоны</NuxtLink>
          </div>
        </div>

        <div class="branch-actions">
          <UiIcon
            name="pencil"
            :size="18"
            class="branch-action"
            title="Настройки"
            @click="openEdit(branch)"
          />
          <UiIcon
            v-if="branches.length > 1"
            name="archive"
            :size="18"
            class="branch-action danger"
            title="Архивировать"
            @click="handleArchive(branch)"
          />
        </div>
      </div>
    </template>

    <UiText v-else size="small">Нет активных филиалов.</UiText>

    <!-- Архив -->
    <template v-if="archivedBranches.length">
      <UiDivider />
      <UiSectionHeader title="Архив" />
      <div v-for="branch in archivedBranches" :key="branch.id" class="branch-row archived">
        <div class="branch-info">
          <UiText size="medium" class="branch-name">{{ branch.name }}</UiText>
          <UiText v-if="branch.address" size="tiny" class="branch-address">{{ branch.address }}</UiText>
        </div>
        <UiButton
          type="text"
          size="medium"
          icon="archiveRestore"
          title="Восстановить"
          @click="handleRestore(branch)"
        />
      </div>
    </template>

    <BranchDrawer
      v-model="drawerOpen"
      :branch="editingBranch"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { UiButton, UiIcon, UiText, UiTag, UiSkeleton, UiDivider, UiSectionHeader, UiAlert } from '@fastio/ui'
import { usePageTitle } from '~/composables/usePageTitle'
import { useConfirm } from '@fastio/kit'
import type { Branch, BranchFormData } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useBranchLimit } from '~/composables/plan/useBranchLimit'
import { useModules } from '~/composables/plan/useModules'
import { useDatabase } from '~/composables/data/useDatabase'
import { useDeliveryZoneStore } from '~/stores/deliveryZone'
import BranchDrawer from '~/components/settings/BranchDrawer.vue'
import useDrawer from '~/composables/ui/useDrawer'

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const api = useDatabase()
const tenantId = computed(() => tenantStore.tenant?.id ?? '')
const { branches, archivedBranches, loading } = storeToRefs(branchStore)
const { add, update, archive, restore } = branchStore
const { confirm } = useConfirm()
const { zones } = storeToRefs(useDeliveryZoneStore())
const modules = useModules()

const { branchLimitReached, maxBranches, branchLimitLabel } = useBranchLimit()
// Модуль филиалов недоступен на текущем тарифе — у тенанта одна точка,
// рендерим страницу как настройки заведения (без списка, без добавления, с апселлом).
const isVenueMode = computed(() => modules.branches.value.locked)

usePageTitle(computed(() => isVenueMode.value ? 'Заведение' : 'Филиалы'))
const deliveryEnabled = computed(() => modules.delivery.value.enabled)
const hasAnyZones = computed(() => zones.value.length > 0)
const branchHasNoZones = (branchId: string) => !zones.value.some((z) => z.branchId === branchId)

const { isOpen: drawerOpen, data: editingBranch, open: openBranchDrawer, close: closeBranchDrawer } = useDrawer<Branch>()

const openAdd = () => openBranchDrawer(null)
const openEdit = (branch: Branch) => openBranchDrawer(branch)

const handleSave = async (data: BranchFormData) => {
  if (editingBranch.value) {
    await update(editingBranch.value.id, data)
  } else {
    await add(data)
  }
  closeBranchDrawer()
}

const handleArchive = async (branch: Branch) => {
  const hasActive = await api.branches.hasActiveOrders(branch.id, tenantId.value)

  if (hasActive) {
    await confirm({
      title: 'Нельзя архивировать филиал',
      message: `У филиала «${branch.name}» есть активные заказы. Переведите все заказы в статус «Выполнен» или «Отменён», а затем попробуйте снова.`,
      confirmText: false,
      cancelText: 'Понятно',
    })

    return
  }

  const confirmed = await confirm({
    title: 'Архивировать филиал?',
    message: `Филиал «${branch.name}» будет скрыт. Его можно будет восстановить из архива.`,
    confirmText: 'Архивировать',
  })

  if (!confirmed) return
  if (branchStore.currentBranchId === branch.id) branchStore.setBranch(null)
  await archive(branch.id)
}

const handleRestore = async (branch: Branch) => {
  if (branchLimitReached.value) {
    await confirm({
      title: 'Лимит филиалов',
      message: `На вашем тарифе доступно ${maxBranches.value} ${branchLimitLabel.value}. Обновите тариф или архивируйте другой филиал.`,
      confirmText: false,
      cancelText: 'Понятно',
    })

    return
  }

  const confirmed = await confirm({
    title: 'Восстановить филиал?',
    message: `Филиал «${branch.name}» снова станет активным.`,
    confirmText: 'Восстановить',
  })

  if (!confirmed) return
  await restore(branch.id)
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.branches-root {
  @include flex-col(var(--space-16));
}

.header-actions {
  display: flex;
  justify-content: flex-end;
}

.upsell-link {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
  margin-left: var(--space-4);

  &:hover { text-decoration: underline; }
}

.branch-row {
  @include flex-row(var(--space-12));
  padding: var(--space-12) 0;
  border-bottom: 1px solid var(--color-border-light);

  &.archived {
    opacity: 0.6;
  }
}

.branch-info {
  @include flex-col(var(--space-4));
  flex: 1;
  min-width: 0;
}

.branch-name-wrap {
  @include flex-row;
}

.branch-name {
  font-weight: var(--font-weight-semibold);
}

.branch-address,
.branch-phone {
  color: var(--color-text-hint);
}

.branch-warning {
  @include flex-row;
}

.branch-warning-text {
  font-size: var(--font-size-sm);
  color: var(--color-error);
}

.branch-actions {
  @include flex-row;
}

.branch-action {
  cursor: pointer;
  color: var(--color-text-hint);

  &:hover { color: var(--color-text); }
  &.danger { color: var(--color-error); }
}

.branch-warning-link {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  text-decoration: none;

  &:hover { text-decoration: underline; }
}
</style>
