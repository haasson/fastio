<template>
  <div class="audit-log-root">
    <div class="toolbar">
      <UiInput
        v-model:value="search"
        placeholder="Поиск по объекту, сотруднику, значению…"
        size="small"
        clearable
        style="width: 460px; max-width: 100%"
      />
      <UiSelect
        v-model:value="filterEntityType"
        :options="entityTypeOptions"
        size="small"
        stateless
        style="min-width: 180px"
      />
      <UiSelect
        v-model:value="filterAction"
        :options="actionOptions"
        size="small"
        stateless
        style="min-width: 150px"
      />
    </div>

    <UiDataTable
      class="audit-table"
      :columns="columns"
      :data="logs"
      :loading="loading"
      :row-key="(row: AuditLog) => row.id"
      size="small"
    />

    <UiEmpty v-if="!loading && logs.length === 0" text="Действий пока не было" />

    <div v-if="total > pageSize" class="pager">
      <UiPagination
        v-model:page="page"
        :item-count="total"
        :page-size="pageSize"
        size="small"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { AuditLog } from '@fastio/shared'
import { formatDateTime } from '@fastio/shared'
import { UiEmpty, UiSelect, UiInput, UiDataTable, UiPagination, UiTag, UiText } from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import { navigateTo } from '#imports'
import { useAuditLog, ENTITY_TYPE_LABELS, entityTypeLabel, actionMeta, renderChanges } from '~/features/audit-log'
import type { RenderedChange } from '~/features/audit-log'
import { useGate } from '~/shared/plan/useGate'
import { useTenantStore } from '~/shared/stores/tenant'
import { usePageTitle } from '~/shared/composables/usePageTitle'

usePageTitle('Журнал действий')

const gate = useGate()
const tenantStore = useTenantStore()
const { list } = useAuditLog()

const ALL = 'all'
const pageSize = 50

const logs = ref<AuditLog[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const filterEntityType = ref<string>(ALL)
const filterAction = ref<string>(ALL)
const search = ref('')

// ─── Гейтинг entity-типов по вертикали и модулям ──────────────────────
// Типы, которые видны только в одной вертикали (retail XOR services).
const RETAIL_ONLY = new Set([
  'dish', 'modifier_group', 'modifier_option', 'addon', 'addon_preset',
  'combo', 'combo_item', 'dish_tag', 'table', 'reservation',
])
const SERVICES_ONLY = new Set(['service'])

// Тип → ключ гейта модуля. Если модуль выключен — тип скрываем.
// Типы без гейта здесь не упоминаются и показываются всегда (в рамках вертикали).
const moduleGateByType: Record<string, () => boolean> = {
  modifier_group: () => gate.modifiers.value.enabled,
  modifier_option: () => gate.modifiers.value.enabled,
  addon: () => gate.addons.value.enabled,
  addon_preset: () => gate.addons.value.enabled,
  combo: () => gate.combos.value.enabled,
  combo_item: () => gate.combos.value.enabled,
  table: () => gate.dineIn.value.enabled,
  reservation: () => gate.reservations.value.enabled,
  service: () => gate.services.value.enabled,
  promo_code: () => gate.promotions.value.enabled,
  promotion: () => gate.promotions.value.enabled,
}

const isTypeVisible = (type: string): boolean => {
  // Вертикаль
  if (RETAIL_ONLY.has(type) && tenantStore.isServices) return false
  if (SERVICES_ONLY.has(type) && !tenantStore.isServices) return false

  // Модуль выключен → прячем. Нет гейта → показываем.
  const moduleEnabled = moduleGateByType[type]

  return moduleEnabled ? moduleEnabled() : true
}

const entityTypeOptions = computed(() => [
  { label: 'Все объекты', value: ALL },
  ...Object.entries(ENTITY_TYPE_LABELS)
    .filter(([value]) => isTypeVisible(value))
    .map(([value, label]) => ({ value, label })),
])

const actionOptions = [
  { label: 'Все действия', value: ALL },
  { label: 'Создано', value: 'created' },
  { label: 'Изменено', value: 'updated' },
  { label: 'Удалено', value: 'deleted' },
  { label: 'Восстановлено', value: 'restored' },
]

const loadLogs = async () => {
  loading.value = true
  try {
    const res = await list({
      limit: pageSize,
      offset: (page.value - 1) * pageSize,
      entityType: filterEntityType.value === ALL ? undefined : filterEntityType.value,
      action: filterAction.value === ALL ? undefined : filterAction.value,
      search: search.value.trim() || undefined,
    })

    logs.value = res.logs
    total.value = res.total
  } catch {
    // Ошибка уже залогирована в auditLogsApi.list (reportError перед throw) — здесь
    // просто сбрасываем выборку, чтобы не показывать устаревшие данные.
    logs.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const debouncedLoad = useDebounceFn(loadLogs, 300)

// Сброс на первую страницу при смене фильтра/поиска — иначе можно «зависнуть»
// на несуществующей странице после сужения выборки.
const resetAndLoad = () => {
  if (page.value !== 1) {
    page.value = 1

    return
  }
  loadLogs()
}

watch([filterEntityType, filterAction], resetAndLoad)
watch(search, () => {
  if (page.value !== 1) {
    page.value = 1

    return
  }
  debouncedLoad()
})
watch(page, loadLogs)

// ─── Колонки ──────────────────────────────────────────────────────────
const hintStyle = 'color: var(--color-text-hint)'

const renderChangeRow = (c: RenderedChange) => {
  if (c.kind === 'complex') {
    return h(UiText, { size: 'tiny', class: 'change-line' }, () => `${c.label}: изменено`)
  }

  if (c.kind === 'price') {
    const newColor = c.direction === 'up'
      ? 'var(--red-500)'
      : c.direction === 'down'
        ? 'var(--green-500)'
        : 'var(--color-text)'

    return h(UiText, { size: 'tiny', class: 'change-line' }, () => [
      `${c.label}: `,
      h('span', { class: 'old-value' }, c.oldValue),
      ' → ',
      h('span', { style: `color: ${newColor}; font-weight: var(--font-weight-medium)` }, c.newValue),
    ])
  }

  return h(UiText, { size: 'tiny', class: 'change-line' }, () => `${c.label}: ${c.oldValue} → ${c.newValue}`)
}

const columns: DataTableColumns<AuditLog> = [
  {
    title: 'Дата',
    key: 'createdAt',
    width: 150,
    render: (row) => h(UiText, { size: 'tiny', style: `${hintStyle}; white-space: nowrap` }, () => formatDateTime(row.createdAt)),
  },
  {
    title: 'Действие',
    key: 'action',
    width: 130,
    render: (row) => {
      const meta = actionMeta(row.action)

      return h(UiTag, { type: meta.tone, size: 'small', round: true, empty: true }, () => meta.label)
    },
  },
  {
    title: 'Объект',
    key: 'entityName',
    width: 220,
    render: (row) => h('div', { class: 'entity-cell' }, [
      h('span', { class: 'entity-type' }, entityTypeLabel(row.entityType)),
      row.entityName
        ? h(UiText, { size: 'tiny', span: true, class: 'entity-name' }, () => row.entityName!)
        : h(UiText, { size: 'tiny', span: true, style: hintStyle }, () => '—'),
    ]),
  },
  {
    title: 'Изменения',
    key: 'changes',
    render: (row) => {
      const changes = renderChanges(row)

      if (changes.length === 0) return h(UiText, { size: 'tiny', style: hintStyle }, () => '—')

      const LIMIT = 6
      const rows = changes.slice(0, LIMIT).map(renderChangeRow)

      if (changes.length > LIMIT) {
        rows.push(h(UiText, { size: 'tiny', class: 'change-line', style: hintStyle }, () => `… ещё ${changes.length - LIMIT}`))
      }

      return h('div', { class: 'changes-cell' }, rows)
    },
  },
  {
    title: 'Сотрудник',
    key: 'actorName',
    width: 170,
    render: (row) => {
      if (!row.actorName) return h(UiText, { size: 'tiny', style: hintStyle }, () => 'Система')

      return h('div', { class: 'actor-cell' }, [
        h(UiText, { size: 'tiny', span: true }, () => row.actorName!),
        row.actorRole ? h(UiText, { size: 'tiny', span: true, style: hintStyle }, () => row.actorRole!) : null,
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

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;
}

// Плотная таблица: ужимаем вертикальные отступы ячеек.
.audit-table {
  :deep(.n-data-table-td),
  :deep(.n-data-table-th) {
    padding-top: var(--space-4);
    padding-bottom: var(--space-4);
    vertical-align: top;
  }
}

.entity-cell {
  display: flex;
  flex-direction: column;
}

.entity-type {
  color: var(--color-text-hint);
  font-size: var(--font-size-sm);
}

.entity-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actor-cell {
  display: flex;
  flex-direction: column;
}

.changes-cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 360px;
}

.change-line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  .old-value {
    color: var(--color-text-hint);
    text-decoration: line-through;
  }
}

.pager {
  display: flex;
  justify-content: flex-end;
}
</style>
