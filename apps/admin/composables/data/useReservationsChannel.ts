import { type Ref } from 'vue'
import type { Reservation } from '@fastio/shared'
import { mapReservation } from '@fastio/shared'
import { useRealtimeWatch } from '~/composables/data/useRealtimeWatch'

type Handler<T> = (payload: T) => void

// Module-level — shared across the app
const insertHandlers = new Set<Handler<Reservation>>()
const updateHandlers = new Set<Handler<Reservation>>()
const deleteHandlers = new Set<Handler<{ id: string }>>()

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
}

/**
 * Call ONCE in layout. Creates a single realtime channel for reservations.
 */
export function useReservationsChannel(tenantId: Ref<string | null>) {
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
  })
}
