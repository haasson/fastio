import { ref, reactive } from 'vue'
import type { JournalEvent } from '@fastio/shared'
import { reportError } from '@fastio/shared/observability'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/shared/data/useDatabase'
import { isAuditLogEnabled } from '~/shared/utils/featureFlags'
import type { JournalListParams } from '../api/journal'

const PAGE_SIZE = 50

type JournalFilters = {
  sources: string[]
  entityTypes: string[]
  eventTypes: string[]
  search: string
  // Период (ISO): from включительно, to — ЭКСКЛЮЗИВНО (начало дня после «до»). null = без границы.
  from: string | null
  to: string | null
}

// Снапшот фильтров активного запроса — чтобы пагинация (loadMore) была
// консистентной, даже если UI мутирует `filters` до клика «загрузить ещё».
// branchId не входит в реактивные filters: скоуп филиала приходит аргументом
// loadInitial (источник — сайдбар), единственный путь, без двойной правды.
type ActiveQuery = JournalFilters & { branchId: string | null }

// Только ЧТЕНИЕ. Запись идёт БД-триггерами / order_events — ручного логирования нет.
export const useJournal = () => {
  const api = useDatabase()
  const tenantStore = useTenantStore()
  const enabled = isAuditLogEnabled()

  const events = ref<JournalEvent[]>([])
  const loading = ref(false)
  const hasMore = ref(false)

  const filters = reactive<JournalFilters>({
    sources: [],
    entityTypes: [],
    eventTypes: [],
    search: '',
    from: null,
    to: null,
  })

  const _active = ref<ActiveQuery | null>(null)

  // Генерация запроса: инкрементируется при reset()/loadInitial(), чтобы
  // батч in-flight-запроса, разрешившийся ПОСЛЕ сброса/нового запроса, не
  // затирал свежий список (stale-batch race).
  const _gen = ref(0)

  const _buildParams = (q: ActiveQuery): JournalListParams => {
    const params: JournalListParams = { branchId: q.branchId, limit: PAGE_SIZE }

    if (q.sources.length) params.sources = q.sources
    if (q.entityTypes.length) params.entityTypes = q.entityTypes
    if (q.eventTypes.length) params.eventTypes = q.eventTypes
    if (q.search) params.search = q.search
    if (q.from) params.from = q.from
    if (q.to) params.to = q.to

    return params
  }

  const loadInitial = async (opts: { branchId?: string | null } = {}): Promise<void> => {
    if (!enabled) return

    // снапшот фильтров на момент запроса
    const query: ActiveQuery = {
      branchId: opts.branchId ?? null,
      sources: [...filters.sources],
      entityTypes: [...filters.entityTypes],
      eventTypes: [...filters.eventTypes],
      search: filters.search,
      from: filters.from,
      to: filters.to,
    }

    _active.value = query
    loading.value = true

    // Инкремент + запоминание поколения этого запроса.
    const gen = ++_gen.value

    try {
      const batch = await api.journal.list(tenantStore.tenant.id, _buildParams(query))

      // Более новый loadInitial()/reset() вытеснил этот запрос — игнорируем батч.
      if (gen !== _gen.value) return

      events.value = batch
      hasMore.value = batch.length === PAGE_SIZE
    } catch (error) {
      reportError(error, { context: 'useJournal.loadInitial' })

      if (gen === _gen.value) {
        events.value = []
        hasMore.value = false
      }
    } finally {
      // Не снимаем спиннер свежего запроса, если этот уже устарел.
      if (gen === _gen.value) loading.value = false
    }
  }

  const loadMore = async (): Promise<void> => {
    if (!enabled) return
    if (loading.value || !hasMore.value) return

    const query = _active.value
    const last = events.value.at(-1)

    if (!query || !last) return

    loading.value = true

    // Продолжаем текущее поколение (не инкрементим) — фиксируем его, чтобы
    // отбросить батч, если reset()/loadInitial() сработает во время await.
    const gen = _gen.value

    try {
      const batch = await api.journal.list(tenantStore.tenant.id, {
        ..._buildParams(query),
        before: last.occurredAt,
        beforeId: last.id,
      })

      // reset()/новый loadInitial() произошёл во время запроса — не аппендим stale-батч.
      if (gen !== _gen.value) return

      events.value = [...events.value, ...batch]
      hasMore.value = batch.length === PAGE_SIZE
    } catch (error) {
      reportError(error, { context: 'useJournal.loadMore' })

      // Стоп-кран: scroll-handler страницы зовёт loadMore на каждое событие скролла
      // у нижней границы — если бэкенд лёг, без этого был бы шторм повторных запросов.
      // «Обновить» (loadInitial) пересчитает hasMore заново.
      if (gen === _gen.value) hasMore.value = false
    } finally {
      if (gen === _gen.value) loading.value = false
    }
  }

  const reset = (): void => {
    // Инвалидируем любой in-flight load ДО очистки состояния.
    _gen.value++

    events.value = []
    hasMore.value = false
    loading.value = false
    _active.value = null
  }

  return { events, loading, hasMore, loadInitial, loadMore, reset, filters, enabled }
}
