<template>
  <UiCard size="large" class="branches-card">
    <UiSectionHeader title="Филиалы">
      <template #right>
        <UiButton
          type="primary"
          icon="plus"
          size="small"
          :disabled="branchLimitReached"
          :title="branchLimitReached ? 'Лимит филиалов на вашем тарифе' : undefined"
          @click="openAdd"
        >Добавить</UiButton>
      </template>
    </UiSectionHeader>

    <template v-if="branches.length">
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
      :color-presets="branchColorPresets"
      @save="handleSave"
      @add-color="onAddBranchColor"
    />
  </UiCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { UiButton, UiCard, UiIcon, UiText, UiTag, UiDivider, UiSectionHeader, useMessage } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { Branch, BranchFormData } from '@fastio/shared'
import { BRANCH_COLOR_PRESETS } from '@fastio/shared'
import { reportError } from '@fastio/shared/observability'
import type { ColorOption } from '~/shared/ui/components/ColorSwatch.vue'
import { useTenantStore } from '~/shared/stores/tenant'
import { useBranchStore } from '~/shared/stores/branch'
import { useBranchLimit } from '~/shared/plan/useBranchLimit'
import { useGate } from '~/shared/plan/useGate'
import { useDatabase } from '~/shared/data/useDatabase'
import { useDeliveryZoneStore } from '~/features/orders'
import BranchDrawer from '~/features/settings/components/BranchDrawer.vue'
import useDrawer from '~/shared/ui/composables/useDrawer'

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const api = useDatabase()
const { error: showError } = useMessage()

const branchColorPresets = computed<ColorOption[]>(() => [
  ...BRANCH_COLOR_PRESETS.map((hex) => ({ value: hex, color: hex })),
  ...(tenantStore.tenant.colorPalettes.branches ?? []).map((hex) => ({ value: hex, color: hex })),
])

const onAddBranchColor = async (hex: string) => {
  try {
    await api.tenants.addColorPreset(tenantStore.tenant.id, 'branches', hex)
    await tenantStore.fetchTenant()
  } catch (e) {
    reportError(e)
    showError('Не удалось сохранить цвет в палитру')
  }
}
const { tenantId } = storeToRefs(tenantStore)
const { branches, archivedBranches } = storeToRefs(branchStore)
const { add, update, archive, restore } = branchStore
const { confirm } = useConfirm()
const { zones } = storeToRefs(useDeliveryZoneStore())
const gate = useGate()

const { branchLimitReached, maxBranches, branchLimitLabel } = useBranchLimit()
const deliveryEnabled = computed(() => gate.delivery.value.enabled)
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
  // Собираем все блокеры параллельно и показываем одним сообщением.
  // Раньше — последовательные if'ы, пользователь видел только первый блокер
  // и не знал что ещё мешает (PREPROD-020).
  const [hasOrders, hasReservations, hasAppointments, hasTables] = await Promise.all([
    api.branches.hasActiveOrders(branch.id, tenantId.value),
    api.branches.hasActiveReservations(branch.id, tenantId.value),
    api.branches.hasActiveAppointments(branch.id, tenantId.value),
    api.branches.hasTables(branch.id),
  ])

  const blockers: string[] = []

  if (hasOrders) blockers.push('— незавершённые заказы на доставку или самовывоз (переведите в «Выполнен» или «Отменён»)')
  if (hasReservations) blockers.push('— активные брони (отмените или подождите их завершения)')
  if (hasAppointments) blockers.push('— активные записи на услуги (отмените или подождите)')
  if (hasTables) blockers.push('— открытые столы (закройте их в разделе Столы)')

  if (blockers.length) {
    await confirm({
      title: 'Нельзя архивировать филиал',
      message: `У филиала «${branch.name}» есть:\n${blockers.join('\n')}\n\nУстраните всё перечисленное и попробуйте снова.`,
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

.branches-card {
  gap: var(--space-12);
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
