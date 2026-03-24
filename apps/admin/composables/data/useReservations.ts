import { computed, ref, watch, onUnmounted, getCurrentInstance, type Ref } from 'vue'
import type { Reservation, ReservationFormData, ReservationStatus } from '@fastio/shared'
import { reservationEvents } from '~/composables/data/useReservationsChannel'
import { useDatabase } from '~/composables/data/useDatabase'
import { RESERVATION_ACTIVE_STATUSES } from '~/utils/reservation-constants'

export const useReservations = (tenantId: Ref<string>, branchId: Ref<string | null>) => {
  const api = useDatabase()

  const reservations = ref<Reservation[]>([])
  const loading = ref(false)
  const filterDate = ref<string | null>(null)
  const filterStatus = ref<ReservationStatus | null>(null)

  const fetch = async () => {
    if (!tenantId.value) return
    loading.value = true
    try {
      reservations.value = await api.reservations.list(tenantId.value, {
        statuses: RESERVATION_ACTIVE_STATUSES,
        branchId: branchId.value ?? undefined,
      })
    } finally {
      loading.value = false
    }
  }

  watch(branchId, fetch)
  fetch()

  const tableNames = computed(() => {
    const names = new Set(reservations.value.map((r) => r.tableName).filter(Boolean) as string[])

    return [...names].sort()
  })

  const filtered = computed(() => {
    let result = reservations.value

    if (filterDate.value) {
      result = result.filter((r) => r.reservedDate === filterDate.value)
    }
    if (filterStatus.value) {
      result = result.filter((r) => r.status === filterStatus.value)
    }

    return result
  })

  const offInsert = reservationEvents.onInsert((r) => {
    if (branchId.value && r.branchId !== branchId.value) return
    if (!reservations.value.find((x) => x.id === r.id)) {
      reservations.value.unshift(r)
    }
  })

  const offUpdate = reservationEvents.onUpdate((r) => {
    if (!RESERVATION_ACTIVE_STATUSES.includes(r.status)) {
      reservations.value = reservations.value.filter((x) => x.id !== r.id)

      return
    }
    if (branchId.value && r.branchId !== branchId.value) return
    const idx = reservations.value.findIndex((x) => x.id === r.id)

    if (idx !== -1) reservations.value[idx] = r
  })

  const offDelete = reservationEvents.onDelete(({ id }) => {
    reservations.value = reservations.value.filter((x) => x.id !== id)
  })

  if (getCurrentInstance()) {
    onUnmounted(() => {
      offInsert()
      offUpdate()
      offDelete()
    })
  }

  const refresh = fetch

  const update = async (id: string, data: {
    guestName?: string
    guestPhone?: string
    guestCount?: number
    reservedDate?: string
    reservedTime?: string
    comment?: string | null
    tableId?: string | null
    tableName?: string | null
  }) => {
    const patch: Record<string, unknown> = {}

    if (data.guestName !== undefined) patch.guest_name = data.guestName
    if (data.guestPhone !== undefined) patch.guest_phone = data.guestPhone
    if (data.guestCount !== undefined) patch.guest_count = data.guestCount
    if (data.reservedDate !== undefined) patch.reserved_date = data.reservedDate
    if (data.reservedTime !== undefined) patch.reserved_time = data.reservedTime
    if (data.comment !== undefined) patch.comment = data.comment
    if (data.tableId !== undefined) patch.table_id = data.tableId
    if (data.tableName !== undefined) patch.table_name = data.tableName

    const res = await api.reservations.update(id, patch)

    if (res) {
      const i = reservations.value.findIndex((r) => r.id === id)

      if (i !== -1) reservations.value[i] = res
    }

    return res
  }

  const create = async (data: ReservationFormData) => {
    if (!tenantId.value) return
    const res = await api.reservations.create(tenantId.value, data)

    if (res) reservations.value.unshift(res)
  }

  const confirm = async (id: string, tableId: string | null, tableName: string | null, confirmedBy: string) => {
    const res = await api.reservations.confirm(id, tableId, tableName, confirmedBy)

    if (res) {
      const i = reservations.value.findIndex((r) => r.id === id)

      if (i !== -1) reservations.value[i] = res
    }

    return res
  }

  const cancel = async (id: string, reason?: string) => {
    await api.reservations.cancel(id, reason)
    await refresh()
  }

  const seat = async (id: string) => {
    const res = await api.reservations.seat(id)

    if (res) {
      const i = reservations.value.findIndex((r) => r.id === id)

      if (i !== -1) reservations.value[i] = res
    }

    return res
  }

  const complete = async (id: string) => {
    await api.reservations.complete(id)
    await refresh()
  }

  return {
    reservations,
    filtered,
    loading,
    filterDate,
    filterStatus,
    tableNames,
    update,
    create,
    confirm,
    cancel,
    seat,
    complete,
    refresh,
  }
}
