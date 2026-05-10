import type { Appointment, AppointmentStatus } from '@fastio/shared'
import { useAuthStore } from '~/shared/stores/auth'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/composables/data/useDatabase'
import { reportError } from '~/utils/reportError'

export type FormSnapshot = {
  serviceId: string | null
  resourceId: string | null
  customerName: string
  customerPhone: string
  notes: string | null
  startsAt: string
  endsAt: string
}

export type EventLookups = {
  serviceName: (id: string) => string | null
  resourceName: (id: string | null) => string | null
}

type FieldChange = { field: string; old_value: unknown; new_value: unknown }

const FIELDS: Array<{
  field: string
  formVal: (f: FormSnapshot) => unknown
  apptVal: (a: Appointment) => unknown
}> = [
  { field: 'service_id', formVal: (f) => f.serviceId, apptVal: (a) => a.serviceId },
  { field: 'resource_id', formVal: (f) => f.resourceId, apptVal: (a) => a.resourceId },
  { field: 'customer_name', formVal: (f) => f.customerName, apptVal: (a) => a.customerName },
  { field: 'customer_phone', formVal: (f) => f.customerPhone, apptVal: (a) => a.customerPhone },
  { field: 'notes', formVal: (f) => f.notes, apptVal: (a) => a.notes },
  { field: 'starts_at', formVal: (f) => f.startsAt, apptVal: (a) => a.startsAt },
  { field: 'ends_at', formVal: (f) => f.endsAt, apptVal: (a) => a.endsAt },
]

export const useAppointmentEventLogger = () => {
  const api = useDatabase()
  const authStore = useAuthStore()
  const tenantStore = useTenantStore()

  const actorBase = (appointment: Appointment) => {
    if (!authStore.user) return null

    return {
      appointmentId: appointment.id,
      tenantId: appointment.tenantId,
      actorId: authStore.user.id,
      actorName: authStore.user.user_metadata?.full_name || authStore.user.email || null,
      actorRole: tenantStore.currentRoleName ?? null,
    }
  }

  /**
   * Логирует diff между формой и текущей записью.
   * Для service_id/resource_id мета содержит человекочитаемые имена через lookups.
   */
  const logFormDiff = (form: FormSnapshot, before: Appointment, lookups: EventLookups) => {
    const actor = actorBase(before)

    if (!actor) return

    const changes: FieldChange[] = []

    for (const m of FIELDS) {
      const newVal = m.formVal(form)
      const oldVal = m.apptVal(before)

      if (newVal === oldVal) continue

      const change: FieldChange = { field: m.field, old_value: oldVal, new_value: newVal }

      if (m.field === 'service_id') {
        change.old_value = typeof oldVal === 'string' ? lookups.serviceName(oldVal) : null
        change.new_value = typeof newVal === 'string' ? lookups.serviceName(newVal) : null
      }
      if (m.field === 'resource_id') {
        change.old_value = lookups.resourceName(oldVal as string | null)
        change.new_value = lookups.resourceName(newVal as string | null)
      }
      changes.push(change)
    }

    if (changes.length === 0) return

    api.appointmentEvents.add({
      ...actor,
      eventType: 'field_updated',
      meta: { changes },
    }).catch(reportError)
  }

  const logStatusChange = (appointment: Appointment, from: AppointmentStatus, to: AppointmentStatus) => {
    const actor = actorBase(appointment)

    if (!actor) return
    api.appointmentEvents.add({
      ...actor,
      eventType: 'status_changed',
      meta: { from, to },
    }).catch(reportError)
  }

  const logExtended = (appointment: Appointment, minutes: number) => {
    const actor = actorBase(appointment)

    if (!actor) return
    api.appointmentEvents.add({
      ...actor,
      eventType: 'extended',
      meta: { minutes },
    }).catch(reportError)
  }

  const logClosedNow = (appointment: Appointment) => {
    const actor = actorBase(appointment)

    if (!actor) return
    api.appointmentEvents.add({
      ...actor,
      eventType: 'closed_now',
      meta: {},
    }).catch(reportError)
  }

  return { logFormDiff, logStatusChange, logExtended, logClosedNow }
}
