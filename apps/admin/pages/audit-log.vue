<template>
  <div class="journal-root">
    <div class="toolbar">
      <UiInput
        v-model:value="searchInput"
        placeholder="Поиск"
        size="small"
        clearable
        class="search"
        @keydown.enter="applySearchIfChanged"
        @blur="applySearchIfChanged"
      />
      <UiSelect
        v-model:value="actionFilter"
        :options="actionOptions"
        size="small"
        multiple
        :max-tag-count="2"
        placeholder="Все действия"
        class="filter-action"
      />
      <UiSelect
        v-model:value="entityTypeFilter"
        :options="entityTypeOptions"
        size="small"
        multiple
        filterable
        :max-tag-count="2"
        placeholder="Все объекты"
        class="filter-entity"
      />
      <UiButton
        size="small"
        :loading="loading"
        class="refresh"
        @click="reload"
      >Обновить</UiButton>
    </div>

    <UiSkeleton v-if="loading && rows.length === 0" text :repeat="6" />

    <UiEmpty
      v-else-if="rows.length === 0"
      :text="enabled ? 'Действий пока не было' : 'Журнал недоступен'"
    />

    <UiDataTable
      v-else
      class="journal-table"
      :columns="columns"
      :data="rows"
      :row-key="(row: JournalRow) => row.id"
      size="small"
      :flex-height="true"
      :scroll-x="1000"
      @scroll="onTableScroll"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDebounceFn } from '@vueuse/core'
import { reportError } from '@fastio/shared/observability'
import { UiButton, UiInput, UiSelect, UiDataTable, UiEmpty, UiSkeleton } from '@fastio/ui'
import { navigateTo } from '#imports'
import { useJournal, ENTITY_TYPE_LABELS, ENTITY_TYPE_GROUPS, ACTION_LABELS, auditLogColumns, toJournalRow } from '~/features/audit-log'
import type { JournalRow } from '~/features/audit-log'
import { useGate } from '~/shared/plan/useGate'
import { useTenantStore } from '~/shared/stores/tenant'
import { useBranchStore } from '~/shared/stores/branch'
import { usePageTitle } from '~/shared/composables/usePageTitle'

usePageTitle('Журнал действий')

const gate = useGate()
const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const { currentBranchId, branches } = storeToRefs(branchStore)

const { events, loading, hasMore, loadInitial, loadMore, filters, enabled } = useJournal()

// Ключ скоупится по тенанту: у юзера с несколькими заведениями фильтры
// журнала не должны перетекать между ними.
const lsKey = (): string => `journal:filters:${tenantStore.tenant?.id ?? ''}`

// ─── Фильтры (UI-зеркала filters из composable) ───────────────────────
// action: multi-select → filters.eventTypes (пустой массив = все). Только конфиг-действия
// (created/updated/deleted/restored); order-события под фильтр действия не подходят.
const actionFilter = ref<string[]>([])
// entityType: multi-select → filters.entityTypes (пустой массив = все)
const entityTypeFilter = ref<string[]>([])
// локальный буфер инпута; в filters.search кладём по enter/blur (или debounce)
const searchInput = ref('')

// Пока гидрируем фильтры из localStorage в onMounted — watchers молчат, иначе
// присвоение persisted-значений вызовет лишний перезапрос поверх первого loadInitial.
const ready = ref(false)

// Опции строим из ACTION_LABELS, чтобы лейблы не разъезжались со словарём.
const actionOptions = computed(() => Object.entries(ACTION_LABELS).map(([value, meta]) => ({ value, label: meta.label })))

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
  order: () => gate.orders.value.enabled,
}

const isTypeVisible = (type: string): boolean => {
  // Вертикаль
  if (RETAIL_ONLY.has(type) && tenantStore.isServices) return false
  if (SERVICES_ONLY.has(type) && !tenantStore.isServices) return false

  // Модуль выключен → прячем. Нет гейта → показываем.
  const moduleEnabled = moduleGateByType[type]

  return moduleEnabled ? moduleEnabled() : true
}

// «Объект» — сгруппированный мультиселект по разделам (ENTITY_TYPE_GROUPS),
// типы отфильтрованы по вертикали/модулям тенанта, пустые группы не показываем.
const entityTypeOptions = computed(() => ENTITY_TYPE_GROUPS
  .map((g) => ({
    type: 'group',
    label: g.label,
    key: g.label,
    children: g.types
      .filter(isTypeVisible)
      .map((t) => ({ label: ENTITY_TYPE_LABELS[t] ?? t, value: t })),
  }))
  .filter((g) => g.children.length > 0))

// ─── localStorage persistence ─────────────────────────────────────────
type PersistedFilters = {
  actions?: string[]
  entityTypes?: string[]
  search?: string
}

const readPersisted = (): PersistedFilters => {
  try {
    const raw = localStorage.getItem(lsKey())

    return raw ? (JSON.parse(raw) as PersistedFilters) : {}
  } catch (error) {
    reportError(error, { context: 'audit-log.readPersisted' })

    return {}
  }
}

const writePersisted = (): void => {
  try {
    const data: PersistedFilters = {
      actions: actionFilter.value,
      entityTypes: entityTypeFilter.value,
      search: searchInput.value,
    }

    localStorage.setItem(lsKey(), JSON.stringify(data))
  } catch (error) {
    reportError(error, { context: 'audit-log.writePersisted' })
  }
}

// UI-фильтры → реактивный filters composable.
const syncFiltersToComposable = (): void => {
  filters.eventTypes = [...actionFilter.value]
  filters.entityTypes = [...entityTypeFilter.value]
  filters.search = searchInput.value.trim()
}

const reload = (): void => {
  loadInitial({ branchId: currentBranchId.value })
}

const applyAndReload = (): void => {
  syncFiltersToComposable()
  writePersisted()
  reload()
}

// Применить поиск только если строка реально изменилась относительно
// активного фильтра. Общий guard для blur/enter и trailing-debounce —
// после немедленного apply отложенный вызов схлопывается в no-op,
// поэтому один финальный search никогда не даёт два loadInitial.
const applySearchIfChanged = (): void => {
  if (searchInput.value.trim() === filters.search) {
    writePersisted()

    return
  }
  applyAndReload()
}

// Поиск с debounce — на лету, но не на каждый символ.
// В VueUse 14 у useDebounceFn нет .cancel(), поэтому от двойного запроса
// (blur после ввода + хвост debounce) защищаемся общим guard'ом выше.
const debouncedApply = useDebounceFn(applySearchIfChanged, 300)

// ─── Бесконечная подгрузка старых записей ─────────────────────────────
// flex-height → таблица скроллится ВНУТРИ себя с фиксированной шапкой. Слушаем
// её @scroll и тянем следующую порцию за 600px до низа. loadMore сам no-op'ит при
// loading || !hasMore || empty, так что частые события не плодят запросов.
const PREFETCH_PX = 600

const onTableScroll = (e: Event): void => {
  const el = e.target as HTMLElement | null

  if (!el) return
  if (el.scrollHeight - el.scrollTop - el.clientHeight <= PREFETCH_PX) loadMore()
}

// ─── Резолв имён филиалов для бейджей ─────────────────────────────────
const branchNames = computed(() => new Map(branches.value.map((b) => [b.id, b.name])))

const rows = computed<JournalRow[]>(() => events.value.map((ev) => toJournalRow(ev, branchNames.value, tenantStore.tenant?.id ?? '')))

// Чип филиала в колонке «Объект» нужен только когда в скоупе несколько филиалов (тенант
// с >1 филиала в режиме «все филиалы»). На конкретном филиале / у одного филиала — область
// очевидна, метку не показываем.
const showBranchLabel = computed(() => branches.value.length > 1 && currentBranchId.value === null)

const columns = computed(() => auditLogColumns({ showBranchLabel: showBranchLabel.value }))

// Смена филиала в сайдбаре → перезапрос журнала с новым скоупом.
watch(currentBranchId, () => {
  if (!ready.value) return
  reload()
})

// Реакция на смену action/entityType-фильтров (search — через enter/blur/debounce).
// Тоже с debounce: мультиселект стреляет на каждый клик — без него юзер,
// отметивший три типа подряд, сделал бы три запроса вместо одного.
const debouncedApplyFilters = useDebounceFn(applyAndReload, 300)

watch([actionFilter, entityTypeFilter], () => {
  if (!ready.value) return
  debouncedApplyFilters()
})
watch(searchInput, () => {
  if (!ready.value) return
  debouncedApply()
})

onMounted(async () => {
  if (!gate.viewAuditLog.value.enabled) {
    navigateTo('/')

    return
  }

  // читаем сохранённые фильтры ДО первого запроса.
  // Значения могут устареть (тип сущности удалён из ENTITY_TYPE_LABELS,
  // неизвестное действие) — отфильтровываем невалидные ключи, иначе UiSelect
  // молча сломает фильтр.
  const persisted = readPersisted()

  // Защита от порченого localStorage: только массив строк, иначе пусто (не роняем onMounted).
  const asKeys = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

  actionFilter.value = asKeys(persisted.actions).filter((a) => a in ACTION_LABELS)
  // невидимый для тенанта тип (чужая вертикаль / выключенный модуль) тоже отбрасываем —
  // иначе persisted-значение молча сузит выдачу без видимого чипа в селекте
  entityTypeFilter.value = asKeys(persisted.entityTypes).filter((t) => t in ENTITY_TYPE_LABELS && isTypeVisible(t))

  searchInput.value = persisted.search ?? ''

  syncFiltersToComposable()
  await loadInitial({ branchId: currentBranchId.value })

  ready.value = true
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.journal-root {
  @include flex-col(var(--space-16));
  // Тулбар закреплён (flex-shrink:0), таблица скроллится внутри себя (flex-height у
  // Naive → раздельная фиксированная шапка). Ограничиваем страницу по высоте вьюпорта
  // (минус топбар и верт. паддинги .content), чтобы таблице было что заполнять.
  // Position:sticky на тулбаре не работает: layout .content имеет overflow-x:auto →
  // он становится scroll-контейнером, но скроллит документ.
  height: calc(100dvh - var(--topbar-height) - var(--content-padding) * 2);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.refresh {
  margin-left: auto;
}

.search {
  width: 460px;
  max-width: 100%;
}

.filter-action {
  min-width: 150px;
}

.filter-entity {
  min-width: 180px;
}

// Таблица заполняет остаток высоты; тело скроллится, шапка зафиксирована (flex-height).
.journal-table {
  flex: 1;
  min-height: 0;

  // Плотная таблица: ужимаем вертикальные отступы ячеек.
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
</style>
