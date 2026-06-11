import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { JournalEvent } from '@fastio/shared'

// --- mocks ---
const listMock = vi.fn()
const enabledRef = { value: true }

vi.mock('~/shared/data/useDatabase', () => ({
  useDatabase: () => ({
    journal: { list: listMock },
  }),
}))

vi.mock('~/shared/stores/tenant', () => ({
  useTenantStore: () => ({ tenant: { id: 't-1' } }),
}))

vi.mock('~/shared/utils/featureFlags', () => ({
  isAuditLogEnabled: () => enabledRef.value,
}))

// import AFTER mocks
import { useJournal } from '../useJournal'

const makeEvent = (id: string, occurredAt: string): JournalEvent => ({
  id,
  source: 'audit',
  eventType: 'updated',
  occurredAt,
  branchId: null,
  actorId: null,
  actorName: null,
  actorEmail: null,
  entityType: 'dish',
  entityId: id,
  entityName: null,
  payload: {},
  changedFields: [],
})

const fullPage = (n: number): JournalEvent[] => Array.from({ length: n }, (_, i) => makeEvent(`e-${i}`, `2026-06-10T${String(10 - i).padStart(2, '0')}:00:00.000Z`))

describe('useJournal', () => {
  beforeEach(() => {
    listMock.mockReset()
    enabledRef.value = true
  })

  it('loadInitial: заполняет events и hasMore=true при полной странице', async () => {
    listMock.mockResolvedValue(fullPage(50))
    const { events, hasMore, loadInitial } = useJournal()

    await loadInitial()

    expect(events.value).toHaveLength(50)
    expect(hasMore.value).toBe(true)
    expect(listMock).toHaveBeenCalledTimes(1)
  })

  it('loadInitial: hasMore=false при короткой странице', async () => {
    listMock.mockResolvedValue([makeEvent('a', '2026-06-10T10:00:00.000Z')])
    const { events, hasMore, loadInitial } = useJournal()

    await loadInitial()

    expect(events.value).toHaveLength(1)
    expect(hasMore.value).toBe(false)
  })

  it('loadMore: передаёт before=occurredAt И beforeId=id последнего события, аппендит', async () => {
    listMock.mockResolvedValueOnce(fullPage(50))
    const { events, loadInitial, loadMore } = useJournal()

    await loadInitial()
    const last = events.value.at(-1) as JournalEvent

    listMock.mockResolvedValueOnce([makeEvent('next', '2026-06-09T10:00:00.000Z')])
    await loadMore()

    const call = listMock.mock.calls[1]

    expect(call[1]).toMatchObject({
      before: last.occurredAt,
      beforeId: last.id,
    })
    expect(events.value).toHaveLength(51)
    expect(events.value.at(-1)?.id).toBe('next')
  })

  it('loadMore: использует branchId/фильтры снапшота loadInitial, а не live-мутацию filters', async () => {
    listMock.mockResolvedValueOnce(fullPage(50))
    const { loadInitial, loadMore, filters } = useJournal()

    await loadInitial({ branchId: 'b-1' })

    // мутируем фильтры в UI до клика "load more"
    filters.search = 'changed'

    listMock.mockResolvedValueOnce([])
    await loadMore()

    expect(listMock.mock.calls[1][1]).toMatchObject({ branchId: 'b-1' })
    expect(listMock.mock.calls[1][1].search).toBeUndefined()
  })

  it('loadInitial: форвардит filters.from/to (период) в db.journal.list', async () => {
    listMock.mockResolvedValue([])
    const { loadInitial, filters } = useJournal()

    filters.from = '2026-06-01T00:00:00.000Z'
    filters.to = '2026-06-11T00:00:00.000Z'
    await loadInitial()

    expect(listMock.mock.calls[0][1]).toMatchObject({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-11T00:00:00.000Z',
    })
  })

  it('loadInitial: пустой период (null) не попадает в параметры запроса', async () => {
    listMock.mockResolvedValue([])
    const { loadInitial } = useJournal()

    await loadInitial()

    expect(listMock.mock.calls[0][1].from).toBeUndefined()
    expect(listMock.mock.calls[0][1].to).toBeUndefined()
  })

  it('loadMore: период берётся из снапшота loadInitial, а не из live-мутации filters', async () => {
    listMock.mockResolvedValueOnce(fullPage(50))
    const { loadInitial, loadMore, filters } = useJournal()

    filters.from = '2026-06-01T00:00:00.000Z'
    filters.to = '2026-06-11T00:00:00.000Z'
    await loadInitial()

    // юзер сменил период в UI до клика «загрузить ещё» — пагинация продолжает старый
    filters.from = '2026-01-01T00:00:00.000Z'
    filters.to = null

    listMock.mockResolvedValueOnce([])
    await loadMore()

    expect(listMock.mock.calls[1][1]).toMatchObject({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-11T00:00:00.000Z',
    })
  })

  it('loadInitial: форвардит filters.eventTypes в db.journal.list', async () => {
    listMock.mockResolvedValue([])
    const { loadInitial, filters } = useJournal()

    filters.eventTypes = ['deleted']
    await loadInitial()

    expect(listMock.mock.calls[0][1]).toMatchObject({ eventTypes: ['deleted'] })
  })

  it('reset: очищает events и hasMore', async () => {
    listMock.mockResolvedValue(fullPage(50))
    const { events, hasMore, loadInitial, reset } = useJournal()

    await loadInitial()
    expect(events.value).toHaveLength(50)

    reset()
    expect(events.value).toHaveLength(0)
    expect(hasMore.value).toBe(false)
  })

  it('guard: при выключенном флаге loadInitial/loadMore не зовут db.journal.list', async () => {
    enabledRef.value = false
    const { events, loadInitial, loadMore } = useJournal()

    await loadInitial()
    await loadMore()

    expect(listMock).not.toHaveBeenCalled()
    expect(events.value).toHaveLength(0)
  })

  it('loadMore: no-op если events пуст', async () => {
    const { loadMore } = useJournal()

    await loadMore()

    expect(listMock).not.toHaveBeenCalled()
  })

  it('loadMore: ошибка запроса гасит hasMore (стоп-кран против шторма ретраев со скролла)', async () => {
    listMock.mockResolvedValueOnce(fullPage(50))
    const { events, hasMore, loadInitial, loadMore } = useJournal()

    await loadInitial()
    expect(hasMore.value).toBe(true)

    listMock.mockRejectedValueOnce(new Error('db down'))
    await loadMore()

    expect(hasMore.value).toBe(false)
    expect(events.value).toHaveLength(50) // загруженное не теряем

    // повторный скролл больше не дёргает запрос
    await loadMore()
    expect(listMock).toHaveBeenCalledTimes(2)
  })

  it('stale-batch race: reset() во время loadMore() отбрасывает поздно пришедший батч', async () => {
    let resolveMore!: (v: JournalEvent[]) => void

    listMock.mockResolvedValueOnce(fullPage(50)) // loadInitial
    const j = useJournal()

    await j.loadInitial()

    listMock.mockReturnValueOnce(new Promise<JournalEvent[]>((r) => {
      resolveMore = r
    }))
    const p = j.loadMore()

    j.reset()
    resolveMore([makeEvent('stale', '2026-06-08T10:00:00.000Z')])
    await p

    expect(j.events.value).toHaveLength(0)
    expect(j.hasMore.value).toBe(false)
  })

  it('reset() во время in-flight loadMore() снимает loading (не залипает спиннер)', async () => {
    let resolveMore!: (v: JournalEvent[]) => void

    listMock.mockResolvedValueOnce(fullPage(50)) // loadInitial
    const j = useJournal()

    await j.loadInitial()

    listMock.mockReturnValueOnce(new Promise<JournalEvent[]>((r) => {
      resolveMore = r
    }))
    const p = j.loadMore()

    expect(j.loading.value).toBe(true)

    j.reset()
    expect(j.loading.value).toBe(false)

    resolveMore([makeEvent('stale', '2026-06-08T10:00:00.000Z')])
    await p

    // stale-батч не воскрешает спиннер
    expect(j.loading.value).toBe(false)
  })
})
