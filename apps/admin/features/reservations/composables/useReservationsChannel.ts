import { type Ref } from 'vue'
import type { Reservation } from '@fastio/shared'
import { mapReservation } from '@fastio/shared'
import { useRealtimeWatch } from '~/shared/data/useRealtimeWatch'

type Handler<T> = (payload: T) => void
type VoidHandler = () => void

// Module-level — shared across the app
const insertHandlers = new Set<Handler<Reservation>>()
const updateHandlers = new Set<Handler<Reservation>>()
const deleteHandlers = new Set<Handler<{ id: string }>>()
const reconnectHandlers = new Set<VoidHandler>()

export const reservationEvents = {
  onInsert(handler: Handler<Reservation>) {
    insertHandlers.add(handler)

    return () => insertHandlers.delete(handler)
  },
  onUpdate(handler: Handler<Reservation>) {
    updateHandlers.add(handler)

    return () => updateHandlers.delete(handler)
  },
  onDelete(handler: Handler<{ id: string }>) {
    deleteHandlers.add(handler)

    return () => deleteHandlers.delete(handler)
  },
  // PREPROD-110: триггерится при reconnect realtime-канала. Consumer'ы
  // используют чтобы пересинхронизировать список броней с сервером.
  onReconnect(handler: VoidHandler) {
    reconnectHandlers.add(handler)

    return () => reconnectHandlers.delete(handler)
  },
}

/**
 * Call ONCE in layout. Creates a single realtime channel for reservations.
 *
 * PREPROD-260: при наличии `branchId` подписка переключается на
 * `branch_id=eq.X`. Reservations с `branch_id IS NULL` (старые/legacy)
 * не попадают в канал когда branch выбран — соответствует UI-фильтру в
 * `useReservations`, который тоже отсекает чужие branchId.
 */
export function useReservationsChannel(tenantId: Ref<string | null>, branchId?: Ref<string | null>) {
  const broadcast = (row: Record<string, unknown>, handlers: Set<Handler<Reservation>>) => {
    try {
      const reservation = mapReservation(row)

      handlers.forEach((h) => h(reservation))
    } catch (e) {
      if (import.meta.dev) console.warn('[useReservationsChannel] malformed payload', e)
    }
  }

  useRealtimeWatch('reservations', tenantId, {
    column: 'tenant_id',
    onInsert: (row) => broadcast(row, insertHandlers),
    onUpdate: (row) => broadcast(row, updateHandlers),
    onDelete: (row) => deleteHandlers.forEach((h) => h({ id: (row as { id: string }).id })),
    onReconnect: () => reconnectHandlers.forEach((h) => h()),
    ...(branchId && { secondary: { column: 'branch_id', value: branchId } }),
  })
}
