// AppointmentRequest как отдельная сущность снесён в миграции 230 — заявка
// теперь это просто визит со status='request'. Здесь оставлен только тип
// одной строки «хотелки» (services jsonb внутри визита) — он используется
// shared mapper'ами и storefront-формой заявки.
export type AppointmentRequestService = {
  serviceId: string
  serviceName: string
  preferredResourceId: string | null
  durationMinutes: number
  price: number
}
