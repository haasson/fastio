<template>
  <div class="appointments-list-root">
    <div class="pills">
      <UiButton
        v-for="pill in PILLS"
        :key="pill.value"
        size="small"
        :type="filter === pill.value ? 'primary' : 'default'"
        @click="setFilter(pill.value)"
      >
        {{ pill.value === 'new' && newCount > 0 ? `${pill.label} (${newCount})` : pill.label }}
      </UiButton>
    </div>

    <UiSkeleton v-if="loading && !rows.length" :repeat="5" />

    <UiEmpty v-else-if="!rows.length && !loading" icon="calendar" text="Записей нет" />

    <template v-else>
      <UiDataTable
        :columns="columns"
        :data="rows"
        :row-key="(row: InboxRow) => row.id"
        :bordered="false"
        :scroll-x="1200"
        size="small"
        :loading="loading"
        :row-props="rowProps"
      />

      <div v-if="total > pageSize" class="pagination">
        <UiButton
          type="text"
          :disabled="page <= 1"
          icon="chevronLeft"
          @click="prevPage"
        />
        <UiText size="small">{{ page }} / {{ totalPages }}</UiText>
        <UiButton
          type="text"
          :disabled="page >= totalPages"
          icon="chevronRight"
          @click="nextPage"
        />
      </div>
    </template>

    <CancelGroupModal
      v-model="cancelModal.show"
      v-model:reason="cancelModal.reason"
      :loading="cancelModal.loading"
      :on-confirm="submitCancelVisit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from '#imports'
import { UiButton, UiDataTable, UiText, UiSkeleton, UiEmpty, useMessage } from '@fastio/ui'
import { visitsBus, useVisitsList, useAppointmentInboxCounter, useInboxTableColumns, type RowActionKind } from '~/features/appointments'
import type {
  Branch,
  InboxRow,
  VisitListRow,
  InboxFilter,
} from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useAuthStore } from '~/shared/stores/auth'
import { useBranchStore } from '~/shared/stores/branch'
import { useDatabase } from '~/shared/data/useDatabase'
import { useGate } from '~/shared/plan/useGate'
import { reportError } from '~/shared/utils/reportError'
import CancelGroupModal from '~/features/appointments/components/CancelGroupModal.vue'

const tenantStore = useTenantStore()
const { currentTenantId, timezone } = storeToRefs(tenantStore)
const authStore = useAuthStore()
const branchStore = useBranchStore()
const api = useDatabase()
const gate = useGate()
const route = useRoute()
const router = useRouter()
const message = useMessage()

// Доступ к сводному списку визитов гейтит middleware/gate.global.ts через
// `viewAllAppointments` — мастер с `view_own` сюда не дойдёт по URL.

const ALLOWED_FILTERS: readonly InboxFilter[] = ['new', 'today', 'week', 'archive', 'all']

const filter = ref<InboxFilter>('new')
const page = ref(1)

const syncFromRoute = () => {
  const f = route.query.filter as string | undefined
  const p = Math.floor(Number(route.query.page))

  filter.value = ALLOWED_FILTERS.includes(f as InboxFilter) ? (f as InboxFilter) : 'new'
  page.value = p >= 1 ? p : 1
}

syncFromRoute()

watch(() => [route.query.filter, route.query.page], () => syncFromRoute())

const pushToUrl = () => {
  router.replace({ query: { ...route.query, filter: filter.value, page: String(page.value) } })
}

const currentBranchId = computed(() => branchStore.currentBranchId)

// Сменили филиал — текущая страница может выйти за пределы пагинации в новом
// филиале (на 5-й странице "Иваново" → 2 страницы "Брянск" → пустота). Сброс на 1.
watch(currentBranchId, (next, prev) => {
  if (next === prev) return
  if (page.value !== 1) {
    page.value = 1
    pushToUrl()
  }
})

const {
  loading, rows, total, totalPages, pageSize, refresh,
} = useVisitsList({ tenantId: currentTenantId, timezone, filter, page, branchId: currentBranchId })

const { count: newCount } = useAppointmentInboxCounter()

let refreshTimer: ReturnType<typeof setTimeout> | null = null

const scheduleRefresh = () => {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(refresh, 500)
}

const realtimeSubs = [
  visitsBus.onInsert(scheduleRefresh),
  visitsBus.onUpdate(scheduleRefresh),
  // PREPROD-110: после reconnect могли пропасть события за период отсутствия.
  visitsBus.onReconnect(scheduleRefresh),
]

onUnmounted(() => {
  realtimeSubs.forEach((off) => off())
  if (refreshTimer) clearTimeout(refreshTimer)
})

const branches = ref<Branch[]>([])
const branchMap = computed(() => new Map(branches.value.map((b) => [b.id, b.name])))

watch(currentTenantId, async (tid) => {
  if (!tid) return
  try {
    branches.value = await api.branches.list(tid)
  } catch (e) {
    reportError(e)
  }
}, { immediate: true })

const rowLoading = ref<Record<string, RowActionKind>>({})

const setRowLoading = (id: string, action: RowActionKind | null) => {
  const next = { ...rowLoading.value }

  if (action === null) delete next[id]
  else next[id] = action
  rowLoading.value = next
}

const cancelModal = reactive({
  show: false,
  targetId: '',
  reason: '',
  loading: false,
})

const handleConfirmVisit = async (row: VisitListRow) => {
  const userId = authStore.user?.id

  if (!userId) return

  setRowLoading(row.id, 'confirm')
  try {
    await api.visits.confirm(row.id, userId)
    refresh()
  } catch (e) {
    reportError(e)
    message.error('Не удалось подтвердить визит')
  } finally {
    setRowLoading(row.id, null)
  }
}

const openCancelVisitModal = (row: VisitListRow) => {
  cancelModal.targetId = row.id
  cancelModal.reason = ''
  cancelModal.loading = false
  cancelModal.show = true
}

const submitCancelVisit = async (): Promise<boolean | void> => {
  cancelModal.loading = true
  try {
    await api.visits.cancelAll(cancelModal.targetId, cancelModal.reason || null)
    refresh()
  } catch (e) {
    reportError(e)
    message.error('Не удалось отменить визит')
    cancelModal.loading = false

    return false
  }
}

const openRow = (row: InboxRow) => {
  router.push(`/appointments/visits/${row.id}`)
}

const rowProps = (row: InboxRow) => ({
  onClick: () => openRow(row),
  style: 'cursor: pointer',
})

const canManage = computed(() => gate.manageAppointments.value.enabled)

const { columns } = useInboxTableColumns({
  branchMap,
  timezone,
  rowLoading,
  canManage,
  onConfirmVisit: handleConfirmVisit,
  onCancelVisit: openCancelVisitModal,
  onOpenRow: openRow,
})

const PILLS: Array<{ value: InboxFilter; label: string }> = [
  { value: 'new', label: 'Новые' },
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
  { value: 'archive', label: 'Архив' },
  { value: 'all', label: 'Все' },
]

const setFilter = (f: InboxFilter) => {
  filter.value = f
  page.value = 1
  pushToUrl()
}

const prevPage = () => {
  if (page.value > 1) {
    page.value--
    pushToUrl()
  }
}

const nextPage = () => {
  if (page.value < totalPages.value) {
    page.value++
    pushToUrl()
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.appointments-list-root {
  @include flex-col(var(--space-16));
}

.pills {
  display: flex;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-12);
}

:deep(.cell-stack) {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

:deep(.cell-name) {
  font-weight: var(--font-weight-medium);
}

:deep(.muted) {
  color: var(--color-text-secondary);
}

:deep(.action-btns) {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

:deep(.btn-danger) {
  color: var(--color-error);
}

:deep(.btn-muted) {
  color: var(--color-text-secondary);
}
</style>
