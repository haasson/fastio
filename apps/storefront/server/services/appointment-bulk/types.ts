import type { getTenantDb } from '../../utils/tenantDb'

export type BulkItem = {
  serviceId: string
  // null = клиент выбрал «любой исполнитель», бэк сам подберёт по round-robin.
  resourceId: string | null
  startTime: string  // "HH:MM"
  // true ⇒ слот в overnight-фазе следующего дня (смена с 22:00 D, слот 01:00 D+1).
  // UTC старт строится как `localDateTimeToUtcIso(date+1, startTime, tz)`.
  isNextDay?: boolean
}

export type BulkPayload = {
  customerName: string
  customerPhone: string
  customerEmail?: string
  date: string
  notes?: string
  items: BulkItem[]
  branchId: string | null
}

export type IdempotentResponse = {
  visitId: string
  appointments: Array<{ id: string; serviceId: string; startsAt: string; endsAt: string }>
}

export type ServiceRow = {
  id: string
  duration: number
  is_bookable: boolean
  name: string
  price: number
  category_id: string | null
}

export type ResolvedItem = {
  serviceId: string
  resourceId: string | null
  startTime: string
  startsAt: string
  endsAt: string
  duration: number
  serviceName: string
  servicePrice: number
  // 'client' если клиент явно выбрал мастера, 'auto' если бэк подобрал.
  assignedBy: 'client' | 'auto'
}

export type TenantDb = ReturnType<typeof getTenantDb>

export type BulkRpcResult = {
  group_id: string
  appointments: Array<{ id: string; service_id: string; starts_at: string; ends_at: string }>
}
