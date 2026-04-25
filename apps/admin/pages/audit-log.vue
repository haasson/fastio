<template>
  <div class="audit-log-root">
    <UiSectionHeader title="Журнал действий">
      <template #right>
        <UiSelect
          v-model:value="filterEntityType"
          :options="entityTypeOptions"
          size="small"
          stateless
          style="min-width: 160px"
        />
      </template>
    </UiSectionHeader>

    <UiDataTable
      :columns="columns"
      :data="filteredLogs"
      :loading="loading"
      :row-key="(row: AuditLog) => row.id"
      size="small"
    />

    <UiEmpty v-if="!loading && filteredLogs.length === 0" text="Действий пока не было" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import type { AuditLog } from '@fastio/shared'
import { formatDateTime } from '@fastio/shared'
import { UiSectionHeader, UiEmpty, UiSelect, UiDataTable, UiTag, UiText, UiSpace } from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import { navigateTo } from '#imports'
import { useAuditLog } from '~/composables/data/useAuditLog'
import { useGate } from '~/composables/plan/useGate'
import { usePageTitle } from '~/composables/usePageTitle'

usePageTitle('Журнал действий')

const gate = useGate()
const { list } = useAuditLog()

const logs = ref<AuditLog[]>([])
const loading = ref(false)
const filterEntityType = ref<string | null>(null)

const ENTITY_TYPE_LABELS: Record<string, string> = {
  member: 'Команда',
  promo_code: 'Промокоды',
  promotion: 'Акции',
  role: 'Роли',
  branch: 'Филиалы',
}

const ACTION_META: Record<string, { label: string; type: 'default' | 'primary' | 'success' | 'warning' | 'error' }> = {
  'member.invite': { label: 'Приглашение', type: 'primary' },
  'member.invite_resend': { label: 'Повтор приглашения', type: 'primary' },
  'member.invite_cancel': { label: 'Отмена приглашения', type: 'warning' },
  'member.remove': { label: 'Удаление участника', type: 'error' },
  'member.block': { label: 'Блокировка', type: 'warning' },
  'member.unblock': { label: 'Разблокировка', type: 'success' },
  'member.role_change': { label: 'Смена роли', type: 'primary' },
  'promo_code.create': { label: 'Промокод создан', type: 'success' },
  'promo_code.update': { label: 'Промокод изменён', type: 'primary' },
  'promo_code.delete': { label: 'Промокод удалён', type: 'error' },
  'promo_code.toggle': { label: 'Промокод вкл/выкл', type: 'primary' },
  'promotion.create': { label: 'Акция создана', type: 'success' },
  'promotion.update': { label: 'Акция изменена', type: 'primary' },
  'promotion.delete': { label: 'Акция удалена', type: 'error' },
  'promotion.toggle': { label: 'Акция вкл/выкл', type: 'primary' },
  'role.create': { label: 'Роль создана', type: 'success' },
  'role.update': { label: 'Роль изменена', type: 'primary' },
  'role.delete': { label: 'Роль удалена', type: 'error' },
  'branch.create': { label: 'Филиал создан', type: 'success' },
  'branch.archive': { label: 'Филиал архивирован', type: 'warning' },
  'branch.restore': { label: 'Филиал восстановлен', type: 'primary' },
}

const entityTypeOptions = computed(() => [
  { label: 'Все действия', value: null },
  ...Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => ({ value, label })),
])

const filteredLogs = computed(() => filterEntityType.value
  ? logs.value.filter((l) => l.entityType === filterEntityType.value)
  : logs.value,
)

const loadLogs = async () => {
  loading.value = true
  try {
    logs.value = await list({ limit: 500 })
  } finally {
    loading.value = false
  }
}

const columns: DataTableColumns<AuditLog> = [
  {
    title: 'Дата',
    key: 'createdAt',
    width: 160,
    render: (row) => h(UiText, { size: 'small', style: 'color: var(--color-text-secondary); white-space: nowrap' }, () => formatDateTime(row.createdAt)),
  },
  {
    title: 'Действие',
    key: 'action',
    width: 200,
    render: (row) => {
      const meta = ACTION_META[row.action]

      return h(UiTag, { type: meta?.type ?? 'default', size: 'small', round: true, empty: true }, () => meta?.label ?? row.action)
    },
  },
  {
    title: 'Объект',
    key: 'entityName',
    render: (row) => h(UiSpace, { size: 4, align: 'center' }, () => [
      row.entityName
        ? h(UiText, { size: 'small' }, () => row.entityName!)
        : h(UiText, { size: 'small', style: 'color: var(--color-text-hint)' }, () => '—'),
      h(UiText, { size: 'tiny', style: 'color: var(--color-text-hint)' }, () => ENTITY_TYPE_LABELS[row.entityType] ?? row.entityType),
    ]),
  },
  {
    title: 'Сотрудник',
    key: 'actorName',
    width: 200,
    render: (row) => {
      if (!row.actorName) return h(UiText, { size: 'small', style: 'color: var(--color-text-hint)' }, () => '—')

      return h('div', {}, [
        h(UiText, { size: 'small' }, () => row.actorName!),
        row.actorRole ? h(UiText, { size: 'tiny', style: 'display: block; color: var(--color-text-hint)' }, () => row.actorRole!) : null,
      ])
    },
  },
]

onMounted(async () => {
  if (!gate.viewAuditLog.value.enabled) {
    navigateTo('/')

    return
  }
  await loadLogs()
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.audit-log-root {
  @include flex-col(var(--space-16));
}
</style>
