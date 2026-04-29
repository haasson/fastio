import { computed, type Ref } from 'vue'
import { mapAppointmentEvent } from '~/utils/api/appointment-events'
import { useRealtimeList } from '~/composables/data/useRealtimeList'
import { useDatabase } from '~/composables/data/useDatabase'

export const useAppointmentEvents = (appointmentId: Ref<string>) => {
  const api = useDatabase()

  const { items: events, loading, refresh } = useRealtimeList({
    channelKey: computed(() => appointmentId.value ? `appointment_events:${appointmentId.value}` : null),
    table: 'appointment_events',
    filter: computed(() => `appointment_id=eq.${appointmentId.value}`),
    fetch: () => api.appointmentEvents.list(appointmentId.value),
    mapper: mapAppointmentEvent,
  })

  return { events, loading, refresh }
}
