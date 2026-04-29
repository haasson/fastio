import { type Ref } from 'vue'
import type { Appointment } from '@fastio/shared'
import { mapAppointment } from '@fastio/shared'
import { useRealtimeWatch } from '~/composables/data/useRealtimeWatch'

type Handler<T> = (payload: T) => void

const insertHandlers = new Set<Handler<Appointment>>()
const updateHandlers = new Set<Handler<Appointment>>()
const deleteHandlers = new Set<Handler<{ id: string }>>()

// HMR: module-level Set'ы переживают Vite-перезагрузки → дублируют нотификации.
// Чистим перед заменой модуля.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    insertHandlers.clear()
    updateHandlers.clear()
    deleteHandlers.clear()
  })
}

/**
 * Realtime broker для appointments — отдельный от `api.appointmentEvents` (CRUD журнала).
 * Подписка на onInsert/onUpdate/onDelete через Supabase Realtime channel.
 */
export const appointmentBus = {
  onInsert(handler: Handler<Appointment>) {
    insertHandlers.add(handler)

    return () => insertHandlers.delete(handler)
  },
  onUpdate(handler: Handler<Appointment>) {
    updateHandlers.add(handler)

    return () => updateHandlers.delete(handler)
  },
  onDelete(handler: Handler<{ id: string }>) {
    deleteHandlers.add(handler)

    return () => deleteHandlers.delete(handler)
  },
}

/** @deprecated используй `appointmentBus`. Алиас оставлен для обратной совместимости. */
export const appointmentEvents = appointmentBus

export function useAppointmentsChannel(tenantId: Ref<string | null>) {
  const broadcast = (row: Record<string, unknown>, handlers: Set<Handler<Appointment>>) => {
    try {
      handlers.forEach((h) => h(mapAppointment(row)))
    } catch (e) {
      if (import.meta.dev) console.warn('[useAppointmentsChannel] malformed payload', e)
    }
  }

  useRealtimeWatch('appointments', tenantId, {
    column: 'tenant_id',
    onInsert: (row) => broadcast(row, insertHandlers),
    onUpdate: (row) => broadcast(row, updateHandlers),
    onDelete: (row) => deleteHandlers.forEach((h) => h({ id: (row as { id: string }).id })),
  })
}
